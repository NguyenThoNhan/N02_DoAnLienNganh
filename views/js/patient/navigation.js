const PatientNavigation = {
  async init(activePage) {
    if (!PatientApp.requireAuth()) return false;

    const mount = document.getElementById('navMount');
    if (!mount) return false;

    try {
      const res = await fetch('/pages/patient/navigation.html');
      if (!res.ok) throw new Error('Không tải được menu');
      mount.innerHTML = await res.text();
    } catch {
      mount.innerHTML = '<aside class="sidebar"><p style="padding:20px">Lỗi menu</p></aside>';
      return false;
    }

    PatientApp.syncNavUser();
    PatientApp.setActiveNav(activePage);
    PatientApp.bindShellEvents();
    PatientApp.setPageTitle(activePage);
    PatientApp.refreshIcons(document.getElementById('sidebar'));

    document.dispatchEvent(new CustomEvent('patient:nav-ready', { detail: { page: activePage } }));
    return true;
  }
};
