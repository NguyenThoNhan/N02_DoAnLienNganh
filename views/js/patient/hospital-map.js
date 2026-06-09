import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js';

(function boot() {
  const user = typeof PatientApp !== 'undefined' ? PatientApp.getUser() : null;
  if (user?.role === 'patient') {
    PatientApp.initPage('hospital_map', init);
  } else {
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) toggle.style.display = 'none';
    init();
  }
})();

function init() {
  const viewport = document.getElementById('map3dViewport');
  const canvas = document.getElementById('map3dCanvas');
  const loading = document.getElementById('map3dLoading');
  const controlsEl = document.getElementById('mapControls');
  const mapPopup = document.getElementById('mapPopup');
  const mapRouteDetail = document.getElementById('mapRouteDetail');
  const deptList = document.getElementById('deptList');
  const deptSearch = document.getElementById('deptSearch');
  if (!viewport || !canvas || !controlsEl || !mapPopup || !mapRouteDetail || !deptList) return;

  const app = typeof PatientApp !== 'undefined' ? PatientApp : {
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    toast: () => {},
    refreshIcons: () => { if (window.lucide) lucide.createIcons(); }
  };

  const GATE = new THREE.Vector3(-42, 0.2, 2);
  const BUILDING_INFO = {
    A: { name: 'Tòa A', color: 0x3b82f6, roof: 0x2563eb, note: 'Khám Nội, Tim mạch, Hô hấp. Quầy tiếp đón tầng 1.' },
    B: { name: 'Tòa B', color: 0xec4899, roof: 0xdb2777, note: 'Xét nghiệm, siêu âm, điện tim.' },
    C: { name: 'Tòa C', color: 0x8b5cf6, roof: 0x7c3aed, note: 'Nhi, Da liễu, Thần kinh.' }
  };

  const LOCATIONS = [
    { id: 'A-TM109', building: 'A', label: 'Khoa Tim mạch', room: 'TM109', floor: 'T1', x: -28, z: -8 },
    { id: 'A-HH108', building: 'A', label: 'Khoa Hô hấp', room: 'HH108', floor: 'T1', x: -18, z: -10 },
    { id: 'A-NT201', building: 'A', label: 'Nội tổng hợp', room: 'NT201', floor: 'T2', x: -24, z: -6 },
    { id: 'B-XN101', building: 'B', label: 'Xét nghiệm máu', room: 'XN101', floor: 'T1', x: 2, z: 14 },
    { id: 'B-SA203', building: 'B', label: 'Siêu âm ổ bụng', room: 'SA203', floor: 'T2', x: 8, z: 16 },
    { id: 'B-ECG115', building: 'B', label: 'Điện tim', room: 'ECG115', floor: 'T1', x: -2, z: 12 },
    { id: 'C-NHI301', building: 'C', label: 'Khoa Nhi', room: 'NHI301', floor: 'T3', x: 26, z: -6 },
    { id: 'C-DL110', building: 'C', label: 'Da liễu', room: 'DL110', floor: 'T1', x: 30, z: -4 },
    { id: 'C-TK210', building: 'C', label: 'Thần kinh', room: 'TK210', floor: 'T2', x: 28, z: -10 }
  ];

  let selectedId = null;
  let routeLine = null;
  let routeGlow = null;
  let routeDestLabel = null;
  const clickable = [];
  const buildingGroups = {};

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0xb8d4f0, 80, 220);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 500);
  camera.position.set(55, 42, 55);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'map3d-label-layer';
  viewport.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 18;
  controls.maxDistance = 120;
  controls.target.set(0, 4, 4);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.15);
  sun.position.set(40, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 150;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xc8e0ff, 0.55));
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d5c3a, 0.35));

  buildCampus();
  renderDeptList(LOCATIONS);
  resize();
  if (loading) loading.classList.add('hidden');
  animate();

  function buildCampus() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 120),
      new THREE.MeshStandardMaterial({ color: 0x5a9e5a, roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const park = new THREE.Mesh(
      new THREE.CircleGeometry(14, 32),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.85 })
    );
    park.rotation.x = -Math.PI / 2;
    park.position.set(-12, 0.02, 18);
    scene.add(park);

    addRoad(0, 0.03, 0, 100, 8);
    addRoad(0, 0.03, 0, 8, 70);

    buildingGroups.A = createTower('A', -24, 0, -8, 22, 14, 18);
    buildingGroups.B = createTower('B', 4, 0, 12, 20, 12, 16);
    buildingGroups.C = createTower('C', 28, 0, -8, 18, 14, 20);

    scene.add(buildingGroups.A, buildingGroups.B, buildingGroups.C);

    createGate();
    scatterTrees();
    createClouds();
  }

  function addRoad(x, y, z, w, d) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.75 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, y, z);
    road.receiveShadow = true;
    scene.add(road);
  }

  function createTower(id, x, y, z, w, h, d) {
    const info = BUILDING_INFO[id];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'building', building: id, ...info };

    const bodyMat = new THREE.MeshStandardMaterial({
      color: info.color,
      roughness: 0.35,
      metalness: 0.08
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.isBody = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.2, 1.4, d + 1.2),
      new THREE.MeshStandardMaterial({ color: info.roof, roughness: 0.4 })
    );
    roof.position.y = h + 0.7;
    roof.castShadow = true;
    group.add(roof);

    addWindows(group, w, h, d);
    addTowerLabel(group, info.name, h + 4);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w + 2, h + 3, d + 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = (h + 3) / 2;
    hit.userData = group.userData;
    group.add(hit);
    clickable.push(hit);

    return group;
  }

  function addWindows(group, w, h, d) {
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.15,
      roughness: 0.2
    });
    const rows = Math.floor(h / 3.5);
    const cols = Math.floor(w / 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), winMat);
        win.position.set(-w / 2 + 2.5 + c * 3, 2.5 + r * 3.5, d / 2 + 0.06);
        group.add(win);
      }
    }
  }

  function addTowerLabel(group, text, y) {
    const el = document.createElement('div');
    el.className = 'map3d-tower-label';
    el.textContent = text;
    const label = new CSS2DObject(el);
    label.position.set(0, y, 0);
    group.add(label);
  }

  function createGate() {
    const g = new THREE.Group();
    g.position.copy(GATE);
    g.position.y = 0;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.2 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), pillarMat);
    p1.position.set(-3, 2.5, 0);
    const p2 = p1.clone();
    p2.position.x = 3;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.8, 1), pillarMat);
    beam.position.y = 5.2;
    g.add(p1, p2, beam);
    const sign = document.createElement('div');
    sign.className = 'map3d-gate-label';
    sign.textContent = 'CỔNG CHÍNH';
    const lbl = new CSS2DObject(sign);
    lbl.position.set(0, 7, 0);
    g.add(lbl);
    scene.add(g);
  }

  function scatterTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
    const spots = [
      [-38, 14], [-50, -20], [45, -22], [50, 20], [-20, -25], [15, -18], [-35, -5], [38, 8]
    ];
    spots.forEach(([x, z]) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6), trunkMat);
      trunk.position.y = 1.1;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 8), leafMat);
      crown.position.y = 4.2;
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      tree.castShadow = true;
      scene.add(tree);
    });
  }

  function createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      roughness: 1
    });
    [[-30, 45, -40], [20, 50, 30], [0, 48, -50]].forEach(([x, y, z]) => {
      const cloud = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2, 10, 10), cloudMat);
        puff.position.set(i * 2.5 - 3, Math.random(), (Math.random() - 0.5) * 2);
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      scene.add(cloud);
    });
  }

  function renderDeptList(items) {
    deptList.innerHTML = items.map((loc) => `
      <li>
        <button type="button" class="map-dept-item ${selectedId === loc.id ? 'active' : ''}" data-dept-id="${loc.id}">
          <span class="map-dept-badge map-dept-badge--${loc.building.toLowerCase()}">${loc.building}</span>
          <span class="map-dept-meta">
            <strong>${app.escapeHtml(loc.label)}</strong>
            <small>${app.escapeHtml(loc.room)} · ${app.escapeHtml(loc.floor)}</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
      </li>`).join('');
    deptList.querySelectorAll('[data-dept-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectLocation(btn.dataset.deptId));
    });
    app.refreshIcons();
  }

  function selectLocation(id) {
    const loc = LOCATIONS.find((x) => x.id === id);
    if (!loc) return;
    selectedId = id;
    renderDeptList(filterDepts(deptSearch?.value || ''));
    highlightBuilding(loc.building);
    drawRoute(loc);
    focusCamera(loc);
    mapRouteDetail.innerHTML = `
      <div class="map-route-active">
        <strong>${app.escapeHtml(loc.label)}</strong>
        <p>Phòng <b>${app.escapeHtml(loc.room)}</b> · ${app.escapeHtml(loc.floor)} · ${app.escapeHtml(BUILDING_INFO[loc.building]?.name || '')}</p>
        <p class="form-hint">Từ cổng chính đi theo đường đỏ trên mặt đất.</p>
      </div>`;
  }

  function filterDepts(q) {
    const t = q.trim().toLowerCase();
    if (!t) return LOCATIONS;
    return LOCATIONS.filter((l) =>
      l.label.toLowerCase().includes(t) ||
      l.room.toLowerCase().includes(t) ||
      l.building.toLowerCase().includes(t)
    );
  }

  function highlightBuilding(b) {
    Object.entries(buildingGroups).forEach(([id, g]) => {
      const body = g.children.find((c) => c.userData?.isBody);
      if (!body?.material) return;
      if (b && id === b) {
        body.material.emissive = new THREE.Color(0x334155);
        body.material.emissiveIntensity = 0.28;
      } else {
        body.material.emissive = new THREE.Color(0x000000);
        body.material.emissiveIntensity = 0;
      }
    });
  }

  function routePoints(loc) {
    const end = new THREE.Vector3(loc.x, 0.25, loc.z);
    const mid1 = new THREE.Vector3(-20, 0.25, 2);
    const mid2 = new THREE.Vector3(0, 0.25, 4);
    if (loc.building === 'A') return [GATE.clone(), mid1, new THREE.Vector3(loc.x, 0.25, 2), end];
    if (loc.building === 'B') return [GATE.clone(), mid2, new THREE.Vector3(4, 0.25, 8), end];
    return [GATE.clone(), mid2, new THREE.Vector3(20, 0.25, 0), end];
  }

  function disposeRoute() {
    if (routeDestLabel) {
      scene.remove(routeDestLabel);
      routeDestLabel = null;
    }
    if (routeLine) {
      scene.remove(routeLine);
      routeLine.geometry.dispose();
      routeLine.material.dispose();
      routeLine = null;
    }
    if (routeGlow) {
      scene.remove(routeGlow);
      routeGlow.geometry.dispose();
      routeGlow.material.dispose();
      routeGlow = null;
    }
  }

  function drawRoute(loc) {
    disposeRoute();
    const pts = routePoints(loc);
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, 64, 0.35, 8, false);
    routeGlow = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xef4444, emissiveIntensity: 0.4, transparent: true, opacity: 0.35 })
    );
    routeGlow.position.y = 0.05;
    scene.add(routeGlow);

    const lineGeom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    routeLine = new THREE.Line(
      lineGeom,
      new THREE.LineBasicMaterial({ color: 0xdc2626, linewidth: 2 })
    );
    routeLine.position.y = 0.35;
    scene.add(routeLine);

    const dest = document.createElement('div');
    dest.className = 'map3d-dest-pin';
    dest.innerHTML = `<span>${app.escapeHtml(loc.room)}</span>`;
    routeDestLabel = new CSS2DObject(dest);
    routeDestLabel.position.set(loc.x, 14, loc.z);
    scene.add(routeDestLabel);
  }

  function clearRoute() {
    selectedId = null;
    disposeRoute();
    highlightBuilding(null);
    mapRouteDetail.textContent = 'Chọn mục bên dưới hoặc bấm «Lịch gần nhất».';
    renderDeptList(filterDepts(deptSearch?.value || ''));
  }

  function focusCamera(loc) {
    const target = new THREE.Vector3(loc.x, 6, loc.z);
    controls.target.copy(target);
  }

  function resetView() {
    clearRoute();
    camera.position.set(55, 42, 55);
    controls.target.set(0, 4, 4);
    controls.update();
  }

  function getLatestRouteTarget() {
    try {
      const raw = localStorage.getItem('booking_slip_last');
      const slip = raw ? JSON.parse(raw) : null;
      if (!slip) return null;
      const room = String(slip.room || '').toUpperCase();
      const byRoom = LOCATIONS.find((x) => room.includes(x.room.toUpperCase()));
      if (byRoom) return byRoom;
      const t = String(slip.floor || slip.department_name || '').toUpperCase();
      if (t.includes('A')) return LOCATIONS.find((x) => x.building === 'A');
      if (t.includes('B')) return LOCATIONS.find((x) => x.building === 'B');
      if (t.includes('C')) return LOCATIONS.find((x) => x.building === 'C');
    } catch { /* ignore */ }
    return null;
  }

  function showPopup(html, x, y) {
    mapPopup.hidden = false;
    mapPopup.innerHTML = html;
    mapPopup.style.left = `${Math.min(x, viewport.clientWidth - 280)}px`;
    mapPopup.style.top = `${Math.min(y, viewport.clientHeight - 120)}px`;
  }

  function hidePopup() {
    mapPopup.hidden = true;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (!hits.length) {
      hidePopup();
      return;
    }
    const data = hits[0].object.userData;
    if (data.type === 'building') {
      showPopup(
        `<strong>${app.escapeHtml(data.name)}</strong><p>${app.escapeHtml(data.note)}</p>
         <button type="button" class="btn btn-outline btn-sm" data-popup-building="${data.building}">Xem phòng trong tòa</button>`,
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      highlightBuilding(data.building);
      mapPopup.querySelector('[data-popup-building]')?.addEventListener('click', () => {
        const first = LOCATIONS.find((l) => l.building === data.building);
        if (first) selectLocation(first.id);
        hidePopup();
      });
    }
  });

  controlsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-map-action]');
    if (!btn) return;
    const action = btn.dataset.mapAction;
    if (action === 'zoom-in') {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(Math.max(controls.getDistance() - 8, 18)));
    }
    if (action === 'zoom-out') {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(Math.min(controls.getDistance() + 8, 120)));
    }
    if (action === 'reset') resetView();
    if (action === 'route-latest') {
      const target = getLatestRouteTarget();
      if (!target) app.toast('Chưa có lịch gần nhất', 'info');
      else {
        selectLocation(target.id);
        app.toast(`Đã dẫn đến ${target.room}`, 'success');
      }
    }
  });

  deptSearch?.addEventListener('input', () => renderDeptList(filterDepts(deptSearch.value)));

  function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  }

  window.addEventListener('resize', resize);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  app.refreshIcons();
}
