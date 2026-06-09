const DoctorNavigation = {
  async init(activePage) {
    if (!DoctorApp.requireAuth()) return false;
    const mount = document.getElementById('navMount');
    if (!mount) return false;
    try {
      const res = await fetch('/pages/doctor/navigation.html');
      mount.innerHTML = await res.text();
    } catch {
      return false;
    }
    DoctorApp.syncNavUser();
    DoctorApp.setActiveNav(activePage);
    DoctorApp.bindShellEvents();
    DoctorApp.setPageTitle(activePage);
    DoctorApp.refreshIcons(document.getElementById('sidebar'));
    document.dispatchEvent(new CustomEvent('doctor:nav-ready', { detail: { page: activePage } }));
    return true;
  }
};
