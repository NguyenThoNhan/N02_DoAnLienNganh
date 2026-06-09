const AdminNavigation = {
  async init(activePage) {
    if (!AdminApp.requireAuth()) return false;
    const mount = document.getElementById('navMount');
    if (!mount) return false;
    try {
      mount.innerHTML = await (await fetch('/pages/admin/navigation.html')).text();
    } catch { return false; }
    AdminApp.syncNavUser();
    AdminApp.setActiveNav(activePage);
    AdminApp.bindShellEvents();
    AdminApp.setPageTitle(activePage);
    AdminApp.refreshIcons(document.getElementById('sidebar'));
    return true;
  }
};
