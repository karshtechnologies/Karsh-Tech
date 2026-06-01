document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIGURATION & DATABASE INITIALIZER ---
  let supabaseClient = null;

  // --- PRODUCTION CREDENTIALS ---
  // If you are ready to launch, paste your live Supabase credentials here:
  const PRODUCTION_SUPABASE_URL = "https://jwoyscbjyvmkekwwkbrn.supabase.co"; 
  const PRODUCTION_SUPABASE_ANON_KEY = "sb_publishable_FWPsXSQxNkR406JQivPooQ_t-6m-PHt";

  // Read config from localStorage if present, otherwise fallback to production keys
  let supabaseUrl = localStorage.getItem("supabase_url") || PRODUCTION_SUPABASE_URL;
  let supabaseAnonKey = localStorage.getItem("supabase_anon_key") || PRODUCTION_SUPABASE_ANON_KEY;

  const initSupabase = () => {
    if (supabaseUrl && supabaseAnonKey && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      } catch (err) {
        console.error("Failed to initialize Supabase client inside Admin Panel:", err);
        supabaseClient = null;
      }
    }
  };

  initSupabase();

  // --- UI ELEMENT SELECTORS ---
  const loader = document.getElementById("adminLoader");
  const loginStage = document.getElementById("adminLoginStage");
  const dashboardStage = document.getElementById("adminDashboardStage");
  const loginForm = document.getElementById("adminLoginForm");
  const logoutBtn = document.getElementById("adminLogoutBtn");

  const metricLeads = document.getElementById("metricLeadsCount");
  const metricBlogs = document.getElementById("metricBlogsCount");
  const metricTeam = document.getElementById("metricTeamCount");
  const metricPortfolios = document.getElementById("metricPortfoliosCount");

  // Toast Notification Helper
  const showToast = (message) => {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">⚡</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    toast.classList.add("active");
    setTimeout(() => {
      toast.classList.remove("active");
    }, 4000);
  };

  // State Overlays Spinner helpers
  const showLoader = () => loader.classList.add("active");
  const hideLoader = () => loader.classList.remove("active");

  // --- AUTHENTICATION FLOW MANAGERS ---
  const checkSession = async () => {
    if (!supabaseClient) {
      showToast("Supabase is not configured. Please open local console to configure keys first.");
      return;
    }
    showLoader();
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (user && !error) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    } finally {
      hideLoader();
    }
  };

  const showLogin = () => {
    loginStage.style.display = "flex";
    dashboardStage.style.display = "none";
  };

  const showDashboard = () => {
    loginStage.style.display = "none";
    dashboardStage.style.display = "block";
    loadAllData();
  };

  // Login Submit Trigger
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showToast("Supabase is not initialized. Check configuration.");
      return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    showLoader();
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      showToast("Access Granted! Welcome to Admin Console.");
      loginForm.reset();
      showDashboard();
    } catch (err) {
      console.error(err);
      showToast(`Login Failed: ${err.message || 'Check credentials'}`);
    } finally {
      hideLoader();
    }
  });

  // Logout Trigger
  logoutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    showLoader();
    try {
      await supabaseClient.auth.signOut();
      showToast("Logged out successfully.");
      showLogin();
    } catch (err) {
      console.error(err);
    } finally {
      hideLoader();
    }
  });

  // --- SIDEBAR TABS NAVIGATORS ---
  const tabs = document.querySelectorAll(".sidebar-tab");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPanel = document.getElementById(tab.getAttribute("data-target"));
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  // --- CORE DATABASE DATA LOADERS ---
  const loadAllData = async () => {
    if (!supabaseClient) return;
    
    // Fetch and load parallel panels
    loadLeads();
    loadBlogs();
    loadTeam();
    loadPortfolios();
  };

  // 1. Load Leads Proposals
  const loadLeads = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("contact_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      metricLeads.textContent = data.length;
      const tbody = document.getElementById("leadsTableBody");
      tbody.innerHTML = "";

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No inquiries submitted yet.</td></tr>`;
        return;
      }

      data.forEach(lead => {
        const tr = document.createElement("tr");
        const date = new Date(lead.created_at).toLocaleDateString();
        tr.innerHTML = `
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${lead.first_name}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${lead.email}</div>
          </td>
          <td>
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Phone: ${lead.phone || 'N/A'}</div>
            <div style="line-height: 1.5; color: var(--text-secondary);">${lead.message}</div>
          </td>
          <td><span class="table-badge">${lead.budget || 'None'}</span></td>
          <td style="white-space: nowrap; color: var(--text-muted);">${date}</td>
          <td>
            <button class="delete-action-btn" data-id="${lead.id}" onclick="deleteLead(${lead.id})">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("Error loading leads:", err);
    }
  };

  // Expose delete lead helper globally for onclick
  window.deleteLead = async (id) => {
    if (!confirm("Are you sure you want to delete this form proposal lead?")) return;
    showLoader();
    try {
      const { error } = await supabaseClient.from("contact_requests").delete().eq("id", id);
      if (error) throw error;
      showToast("Lead proposal deleted successfully.");
      loadLeads();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete lead.");
    } finally {
      hideLoader();
    }
  };



  // 3. Load Blogs CRUD
  const loadBlogs = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("blogs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      metricBlogs.textContent = data.length;
      const list = document.getElementById("blogsList");
      list.innerHTML = "";

      if (data.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">No blog posts composed.</div>`;
        return;
      }

      data.forEach(post => {
        const div = document.createElement("div");
        div.className = "entry-card";
        div.innerHTML = `
          <div class="entry-info">
            <div class="entry-title">${post.title}</div>
            <div class="entry-subtitle">${post.category} • By ${post.author}</div>
          </div>
          <div class="entry-actions">
            <button class="edit-action-btn" onclick="editBlogPost(${post.id})">✏️</button>
            <button class="delete-action-btn" onclick="deleteBlogPost(${post.id})">🗑️</button>
          </div>
        `;
        list.appendChild(div);
      });
    } catch (err) {
      console.error("Error loading blogs:", err);
    }
  };

  const blogForm = document.getElementById("blogComposeForm");
  const blogCancelBtn = document.getElementById("blogCancelEditBtn");
  const blogSubmitBtn = document.getElementById("blogSubmitBtn");
  const blogFormTitle = document.getElementById("blogFormTitle");

  const resetBlogForm = () => {
    blogForm.reset();
    document.getElementById("blogEditId").value = "";
    blogCancelBtn.style.display = "none";
    blogSubmitBtn.textContent = "Publish Post";
    blogFormTitle.textContent = "Publish New Blog";
  };

  blogCancelBtn.onclick = resetBlogForm;

  blogForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoader();

    const id = document.getElementById("blogEditId").value;
    const title = document.getElementById("blogTitle").value.trim();
    const subtitle = document.getElementById("blogSubtitle").value.trim();
    const category = document.getElementById("blogCategory").value;
    const author = document.getElementById("blogAuthor").value.trim();
    const content = document.getElementById("blogContent").value.trim();
    const image = document.getElementById("blogImage").value.trim() || "assets/blog-placeholder.jpg";

    try {
      if (id) {
        // Update
        const { error } = await supabaseClient
          .from("blogs")
          .update({ title, subtitle, category, author, content, image_url: image })
          .eq("id", id);
        if (error) throw error;
        showToast("Blog article updated successfully!");
      } else {
        // Insert
        const { error } = await supabaseClient
          .from("blogs")
          .insert([{ title, subtitle, category, author, content, image_url: image }]);
        if (error) throw error;
        showToast("New blog article published successfully!");
      }
      resetBlogForm();
      loadBlogs();
    } catch (err) {
      console.error(err);
      showToast(`Failed to publish blog: ${err.message}`);
    } finally {
      hideLoader();
    }
  });

  window.editBlogPost = async (id) => {
    showLoader();
    try {
      const { data, error } = await supabaseClient.from("blogs").select("*").eq("id", id).single();
      if (error) throw error;

      document.getElementById("blogEditId").value = data.id;
      document.getElementById("blogTitle").value = data.title;
      document.getElementById("blogSubtitle").value = data.subtitle;
      document.getElementById("blogCategory").value = data.category;
      document.getElementById("blogAuthor").value = data.author;
      document.getElementById("blogContent").value = data.content;
      document.getElementById("blogImage").value = data.image_url === "assets/blog-placeholder.jpg" ? "" : data.image_url;

      blogCancelBtn.style.display = "block";
      blogSubmitBtn.textContent = "Save Changes";
      blogFormTitle.textContent = "Edit Blog Article";

      // Jump to forms trigger view
      document.getElementById("blogsPanel").scrollTop = 0;
      showToast(`Editing: ${data.title}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch blog details.");
    } finally {
      hideLoader();
    }
  };

  window.deleteBlogPost = async (id) => {
    if (!confirm("Are you sure you want to delete this blog article? This action cannot be undone.")) return;
    showLoader();
    try {
      const { error } = await supabaseClient.from("blogs").delete().eq("id", id);
      if (error) throw error;
      showToast("Blog article deleted successfully.");
      loadBlogs();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete blog article.");
    } finally {
      hideLoader();
    }
  };

  // 4. Load Team CRUD
  const loadTeam = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      metricTeam.textContent = data.length;
      const list = document.getElementById("teamList");
      list.innerHTML = "";

      if (data.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">No team members added.</div>`;
        return;
      }

      data.forEach(member => {
        const div = document.createElement("div");
        div.className = "entry-card";
        div.innerHTML = `
          <div class="entry-info" style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--accent-neon); background: radial-gradient(circle, ${member.bg_color} 0%, #0c0c0c 100%); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: var(--accent-neon);">${member.initials}</div>
            <div>
              <div class="entry-title">${member.name}</div>
              <div class="entry-subtitle">${member.role}</div>
            </div>
          </div>
          <div class="entry-actions">
            <button class="edit-action-btn" onclick="editTeamMember(${member.id})">✏️</button>
            <button class="delete-action-btn" onclick="deleteTeamMember(${member.id})">🗑️</button>
          </div>
        `;
        list.appendChild(div);
      });
    } catch (err) {
      console.error("Error loading team roster:", err);
    }
  };

  const teamForm = document.getElementById("teamComposeForm");
  const teamCancelBtn = document.getElementById("teamCancelEditBtn");
  const teamSubmitBtn = document.getElementById("teamSubmitBtn");
  const teamFormTitle = document.getElementById("teamFormTitle");

  const resetTeamForm = () => {
    teamForm.reset();
    document.getElementById("teamEditId").value = "";
    teamCancelBtn.style.display = "none";
    teamSubmitBtn.textContent = "Add to Roster";
    teamFormTitle.textContent = "Add Team Member";
  };

  teamCancelBtn.onclick = resetTeamForm;

  teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoader();

    const id = document.getElementById("teamEditId").value;
    const name = document.getElementById("teamMemberName").value.trim();
    const role = document.getElementById("teamMemberRole").value.trim();
    const initials = document.getElementById("teamMemberInitials").value.trim().toUpperCase();
    const color = document.getElementById("teamMemberColor").value;

    try {
      if (id) {
        // Update
        const { error } = await supabaseClient
          .from("team_members")
          .update({ name, role, initials, bg_color: color })
          .eq("id", id);
        if (error) throw error;
        showToast("Roster profile updated successfully!");
      } else {
        // Insert
        const { error } = await supabaseClient
          .from("team_members")
          .insert([{ name, role, initials, bg_color: color }]);
        if (error) throw error;
        showToast("Team member added to roster successfully!");
      }
      resetTeamForm();
      loadTeam();
    } catch (err) {
      console.error(err);
      showToast(`Failed to configure member: ${err.message}`);
    } finally {
      hideLoader();
    }
  });

  window.editTeamMember = async (id) => {
    showLoader();
    try {
      const { data, error } = await supabaseClient.from("team_members").select("*").eq("id", id).single();
      if (error) throw error;

      document.getElementById("teamEditId").value = data.id;
      document.getElementById("teamMemberName").value = data.name;
      document.getElementById("teamMemberRole").value = data.role;
      document.getElementById("teamMemberInitials").value = data.initials;
      document.getElementById("teamMemberColor").value = data.bg_color;

      teamCancelBtn.style.display = "block";
      teamSubmitBtn.textContent = "Save Changes";
      teamFormTitle.textContent = "Edit Roster Details";

      showToast(`Editing: ${data.name}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch roster details.");
    } finally {
      hideLoader();
    }
  };

  window.deleteTeamMember = async (id) => {
    if (!confirm("Are you sure you want to remove this member from the active roster?")) return;
    showLoader();
    try {
      const { error } = await supabaseClient.from("team_members").delete().eq("id", id);
      if (error) throw error;
      showToast("Team member removed from active roster.");
      loadTeam();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete member.");
    } finally {
      hideLoader();
    }
  };

  // 5. Load Portfolios CRUD
  const loadPortfolios = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("portfolios")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      metricPortfolios.textContent = data.length;
      const list = document.getElementById("portfoliosList");
      list.innerHTML = "";

      if (data.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">No developer portfolios showcase configured.</div>`;
        return;
      }

      data.forEach(port => {
        const div = document.createElement("div");
        div.className = "entry-card";
        div.innerHTML = `
          <div class="entry-info">
            <div class="entry-title">${port.name}</div>
            <div class="entry-subtitle">${port.designation}</div>
          </div>
          <div class="entry-actions">
            <button class="edit-action-btn" onclick="editPortfolio(${port.id})">✏️</button>
            <button class="delete-action-btn" onclick="deletePortfolio(${port.id})">🗑️</button>
          </div>
        `;
        list.appendChild(div);
      });
    } catch (err) {
      console.error("Error loading portfolios:", err);
    }
  };

  const portfolioForm = document.getElementById("portfolioComposeForm");
  const portfolioCancelBtn = document.getElementById("portfolioCancelEditBtn");
  const portfolioSubmitBtn = document.getElementById("portfolioSubmitBtn");
  const portfolioFormTitle = document.getElementById("portfolioFormTitle");

  const resetPortfolioForm = () => {
    portfolioForm.reset();
    document.getElementById("portfolioEditId").value = "";
    document.getElementById("portfolioGithub").value = "#";
    document.getElementById("portfolioLinkedin").value = "#";
    document.getElementById("portfolioInstagram").value = "#";
    document.getElementById("portfolioPersonal").value = "#";
    portfolioCancelBtn.style.display = "none";
    portfolioSubmitBtn.textContent = "Create Portfolio";
    portfolioFormTitle.textContent = "Create Developer Portfolio";
  };

  portfolioCancelBtn.onclick = resetPortfolioForm;

  portfolioForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoader();

    const id = document.getElementById("portfolioEditId").value;
    const name = document.getElementById("portfolioName").value.trim();
    const designation = document.getElementById("portfolioDesignation").value.trim();
    const specialisation = document.getElementById("portfolioSpecialisation").value.trim();
    const description = document.getElementById("portfolioDesc").value.trim();
    const photo = document.getElementById("portfolioPhoto").value.trim() || null;
    const github = document.getElementById("portfolioGithub").value.trim() || "#";
    const linkedin = document.getElementById("portfolioLinkedin").value.trim() || "#";
    const instagram = document.getElementById("portfolioInstagram").value.trim() || "#";
    const portfolio = document.getElementById("portfolioPersonal").value.trim() || "#";

    try {
      if (id) {
        // Update
        const { error } = await supabaseClient
          .from("portfolios")
          .update({
            name,
            designation,
            specialisation,
            description,
            photo_url: photo,
            github_url: github,
            linkedin_url: linkedin,
            instagram_url: instagram,
            portfolio_url: portfolio
          })
          .eq("id", id);
        if (error) throw error;
        showToast("Portfolio profile updated successfully!");
      } else {
        // Insert
        const { error } = await supabaseClient
          .from("portfolios")
          .insert([{
            name,
            designation,
            specialisation,
            description,
            photo_url: photo,
            github_url: github,
            linkedin_url: linkedin,
            instagram_url: instagram,
            portfolio_url: portfolio
          }]);
        if (error) throw error;
        showToast("Developer portfolio created successfully!");
      }
      resetPortfolioForm();
      loadPortfolios();
    } catch (err) {
      console.error(err);
      showToast(`Failed to save portfolio: ${err.message}`);
    } finally {
      hideLoader();
    }
  });

  window.editPortfolio = async (id) => {
    showLoader();
    try {
      const { data, error } = await supabaseClient.from("portfolios").select("*").eq("id", id).single();
      if (error) throw error;

      document.getElementById("portfolioEditId").value = data.id;
      document.getElementById("portfolioName").value = data.name;
      document.getElementById("portfolioDesignation").value = data.designation;
      document.getElementById("portfolioSpecialisation").value = data.specialisation;
      document.getElementById("portfolioDesc").value = data.description;
      document.getElementById("portfolioPhoto").value = data.photo_url || "";
      document.getElementById("portfolioGithub").value = data.github_url;
      document.getElementById("portfolioLinkedin").value = data.linkedin_url;
      document.getElementById("portfolioInstagram").value = data.instagram_url;
      document.getElementById("portfolioPersonal").value = data.portfolio_url;

      portfolioCancelBtn.style.display = "block";
      portfolioSubmitBtn.textContent = "Save Changes";
      portfolioFormTitle.textContent = "Edit Portfolio Details";

      showToast(`Editing Showcase: ${data.name}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch portfolio details.");
    } finally {
      hideLoader();
    }
  };

  window.deletePortfolio = async (id) => {
    if (!confirm("Are you sure you want to delete this developer showcase portfolio?")) return;
    showLoader();
    try {
      const { error } = await supabaseClient.from("portfolios").delete().eq("id", id);
      if (error) throw error;
      showToast("Showcase portfolio deleted successfully.");
      loadPortfolios();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete showcase.");
    } finally {
      hideLoader();
    }
  };

  // --- INITIAL CHECK ON PAGE LOAD ---
  checkSession();
});
