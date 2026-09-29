/**
 * SIP-RLTH (Sistem Informasi & Monitoring Rumah Tidak Layak Huni)
 * Core Application Engine
 */

class RTLHDashboardApp {
  constructor() {
    this.sheetId = "1UJ0ypFjBGbxwPgrwXFlValZtijIu7Jf6j0XzlHgFCDc";
    this.sheetGid = "1707297001";
    this.dataSource = "live"; // 'sample' | 'live'
    this.rawData = [];
    this.filteredData = [];
    this.liveSheetData = [];
    
    // Pagination & Sort State
    this.currentPage = 1;
    this.pageSize = 10;
    this.sortField = "timestamp";
    this.sortOrder = "desc";
    
    // Filter & Search State
    this.searchQuery = "";
    this.filters = {
      kabupaten: "",
      kecamatan: "",
      desa: "",
      desil: "",
      lahan: "",
      prioritas: ""
    };
    
    // UI State
    this.selectedRecord = null;
    this.isMaskNIK = true;
    this.charts = {};
    this.autoRefreshTimer = null;
    this.autoRefreshIntervalMs = 60000; // 1 min
    this.lastSyncTime = null;
    this.currentTheme = localStorage.getItem("sip_rlth_theme") || "light";

    this.init();
  }

  init() {
  this.applyTheme(this.currentTheme);
  this.setupAutoRefresh();

  // Load Google Sheet langsung saat pertama buka
  this.fetchGoogleSheetData(false)
    .then(() => {

      this.dataSource = "live";
      this.rawData = [...this.liveSheetData];

      // render ulang semua komponen
      this.updateKabupatenFilterDropdown();
      this.applyFilters();

      this.updateLastSyncDisplay();

    })
    .catch((error) => {

      console.error("Gagal mengambil Google Sheet:", error);

      this.dataSource = "live";
      this.rawData = [];

      this.applyFilters();

    });
}

  /* ================= THEME TOGGLE ================= */
  toggleTheme() {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
    localStorage.setItem("sip_rlth_theme", this.currentTheme);
    this.applyTheme(this.currentTheme);
    this.renderCharts();
  }

  applyTheme(theme) {
    const html = document.documentElement;
    const themeIcon = document.getElementById("theme-icon");
    if (theme === "dark") {
      html.classList.add("dark");
      if (themeIcon) themeIcon.setAttribute("data-lucide", "sun");
    } else {
      html.classList.remove("dark");
      if (themeIcon) themeIcon.setAttribute("data-lucide", "moon");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  /* ================= DATA SOURCE SWITCHING ================= */
  setDataSource(source) {
    this.dataSource = source;
    const btnLive = document.getElementById("btn-mode-live");
    const btnSample = document.getElementById("btn-mode-sample");
    const banner = document.getElementById("notice-banner");
    const bannerTitle = document.getElementById("banner-title");
    const bannerDesc = document.getElementById("banner-desc");
    const bannerBtn = document.getElementById("banner-action-btn");
    const statusText = document.getElementById("sync-status-text");

    if (source === "live") {
      btnLive.className = "px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm transition-all font-semibold";
      btnSample.className = "px-2.5 py-1.5 rounded-lg transition-all text-slate-600 dark:text-slate-300 hover:text-brand-600";
      
      this.rawData = [...this.liveSheetData];
      statusText.textContent = "Google Sheets Live";

      if (this.rawData.length === 0) {
        banner.className = "rounded-2xl p-4 transition-all border flex items-start justify-between shadow-sm bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200";
        bannerTitle.textContent = "Terhubung ke Google Sheet (0 Usulan Riil)";
        bannerDesc.textContent = "Spreadsheet terhubung dengan sukses, namun belum ada respon usulan baru yang masuk melalui Google Form. Beralih ke Data Simulasi untuk melihat visualisasi lengkap.";
        bannerBtn.textContent = "Gunakan Data Simulasi";
      } else {
        banner.className = "rounded-2xl p-4 transition-all border flex items-start justify-between shadow-sm bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200";
        bannerTitle.textContent = `Mode Live Google Sheets Aktif (${this.rawData.length} Usulan Terdata)`;
        bannerDesc.textContent = "Menampilkan data usulan riil hasil pengisian formulir Google Form RTLH secara realtime.";
        bannerBtn.textContent = "Beralih ke Simulasi";
      }
    } else {
      btnSample.className = "px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm transition-all font-semibold";
      btnLive.className = "px-2.5 py-1.5 rounded-lg transition-all text-slate-600 dark:text-slate-300 hover:text-brand-600";
      
      this.rawData = (window.SAMPLE_RTLH_DATA || []).map(item => this.enrichRecord(item));
      statusText.textContent = "Mode Simulasi";

      banner.className = "rounded-2xl p-4 transition-all border flex items-start justify-between shadow-sm bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200";
      bannerTitle.textContent = `Mode Data Simulasi Aktif (${this.rawData.length} Usulan Contoh)`;
      bannerDesc.textContent = "Menampilkan contoh data survei lapangan lengkap agar Anda dapat melihat visualisasi grafik, filtering, dan lembar verifikasi RTLH.";
      bannerBtn.textContent = "Coba Live Sheet";
    }

    this.updateKabupatenFilterDropdown();
    this.applyFilters();
    this.updateLastSyncDisplay();
    if (window.lucide) window.lucide.createIcons();
  }

  toggleModeFromBanner() {
      this.setDataSource("live");
      this.refreshData();
    }

  /* ================= GOOGLE SHEETS FETCH ENGINE (JSONP / CROS-FREE) ================= */
  fetchGoogleSheetData(showIndicator = true) {
    const refreshIcon = document.getElementById("refresh-icon");
    if (showIndicator && refreshIcon) {
      refreshIcon.classList.add("animate-spin");
    }

    return new Promise((resolve, reject) => {
      const callbackName = "gvizCallback_" + Math.floor(Math.random() * 1000000);
      const url = `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&gid=${this.sheetGid}&_nocache=${Date.now()}`;
      
      let timer = setTimeout(() => {
        cleanup();
        if (showIndicator && refreshIcon) refreshIcon.classList.remove("animate-spin");
        reject(new Error("Timeout mengambil data dari Google Sheets"));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timer);
        if (window[callbackName]) delete window[callbackName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      };

      window[callbackName] = (data) => {
        cleanup();
        if (showIndicator && refreshIcon) refreshIcon.classList.remove("animate-spin");
        this.parseGoogleSheetResponse(data);
        resolve(this.liveSheetData);
      };

      const script = document.createElement("script");
      script.src = url;
      script.onerror = (err) => {
        cleanup();
        if (showIndicator && refreshIcon) refreshIcon.classList.remove("animate-spin");
        console.warn("JSONP error, mencoba metode fallback...", err);
        // Fallback fetch
        this.fetchWithFallback().then(resolve).catch(reject);
      };
      document.body.appendChild(script);
    });
  }

  async fetchWithFallback() {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:json&gid=${this.sheetGid}&_nocache=${Date.now()}`;
      const res = await fetch(url);
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (match && match[1]) {
        const json = JSON.parse(match[1]);
        this.parseGoogleSheetResponse(json);
        return this.liveSheetData;
      }
      return [];
    } catch (e) {
      console.error("Gagal sinkronisasi data Google Sheet:", e);
      throw e;
    }
  }

  parseGoogleSheetResponse(data) {
    if (!data || !data.table || !data.table.rows) {
      this.liveSheetData = [];
      return;
    }

    const rows = data.table.rows;
    if (rows.length === 0) {
      this.liveSheetData = [];
      return;
    }

    // Check if row 0 is header row
    let startIndex = 0;
    const firstRowVal = rows[0]?.c?.[0]?.v || "";
    if (String(firstRowVal).toLowerCase().includes("timestamp")) {
      startIndex = 1;
    }

    const parsed = [];
    for (let i = startIndex; i < rows.length; i++) {
      const c = rows[i].c || [];
      const getVal = (idx) => {
        if (!c[idx]) return "";
        return c[idx].f !== undefined && c[idx].f !== null ? String(c[idx].f).trim() : (c[idx].v !== undefined && c[idx].v !== null ? String(c[idx].v).trim() : "");
      };

      const nama = getVal(4);
      // Skip blank rows
      if (!nama && !getVal(1)) continue;

      const record = {
        timestamp: getVal(0) || new Date().toISOString().replace("T", " ").substring(0, 19),
        kabupatenKota: getVal(1) || "Kabupaten Tangerang",
        kecamatan: getVal(2) || "-",
        kelurahanDesa: getVal(3) || "-",
        namaPenerima: nama || "Tanpa Nama",
        nik: getVal(5) || "-",
        ttl: getVal(6) || "-",
        pekerjaan: getVal(7) || "-",
        noHpWa: getVal(8) || "-",
        alamat: getVal(9) || "-",
        penghasilanUmp: getVal(10) || "Ya (< UMP/UMK)",
        cekStatusDesil: getVal(11) || "Sudah Dicek",
        hasilDesil: getVal(12) || "Desil 1",
        statusLahan: getVal(13) || "Milik Sendiri",
        luasTanah: getVal(14) || "-",
        ktpUrl: this.formatDriveLink(getVal(15)),
        sertifikatUrl: this.formatDriveLink(getVal(16)),
        kkUrl: this.formatDriveLink(getVal(17)),
        bagianKerusakan: getVal(18) || "Kerusakan ALADIN",
        fotoDepan: this.formatDriveLink(getVal(19)),
        fotoBelakang: this.formatDriveLink(getVal(20)),
        fotoSamping: this.formatDriveLink(getVal(21)),
        fotoMck: this.formatDriveLink(getVal(22)),
        namaPengusul: getVal(23) || "Petugas Lapangan"
      };

      parsed.push(this.enrichRecord(record));
    }

    this.liveSheetData = parsed;
    this.lastSyncTime = new Date();
  }

  formatDriveLink(url) {
    if (!url) return "";
    // If it's a Google Drive link, extract ID
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      // Convert to viewable thumbnail
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
  }

  /* ================= RTLH PRIORITY SCORING ENGINE ================= */
  enrichRecord(record) {
    let score = 0;
    const desil = (record.hasilDesil || "").toLowerCase();
    
    // 1. Desil Kemiskinan Bobot (Max 40 poin)
    if (desil.includes("desil 1") || desil.includes("1")) {
      score += 40;
    } else if (desil.includes("desil 2") || desil.includes("2")) {
      score += 30;
    } else if (desil.includes("desil 3") || desil.includes("3")) {
      score += 20;
    } else if (desil.includes("desil 4") || desil.includes("4")) {
      score += 10;
    } else {
      score += 5;
    }

    // 2. Penghasilan < UMP (Max 10 poin)
    if ((record.penghasilanUmp || "").toLowerCase().includes("ya")) {
      score += 10;
    }

    // 3. Legalitas Lahan (Max 20 poin - Syarat Clean & Clear)
    const lahan = (record.statusLahan || "").toLowerCase();
    if (lahan.includes("sendiri") || lahan.includes("shm") || lahan.includes("girik") || lahan.includes("hibah")) {
      score += 20;
    } else if (lahan.includes("keluarga") || lahan.includes("warisan")) {
      score += 10;
    } else {
      score += 0;
    }

    // 4. Kerusakan ALADIN & Sanitasi (Max 30 poin)
    const kerusakan = (record.bagianKerusakan || "").toLowerCase();
    let hasAtap = kerusakan.includes("atap");
    let hasDinding = kerusakan.includes("dinding") || kerusakan.includes("bambu") || kerusakan.includes("kayu");
    let hasLantai = kerusakan.includes("lantai") || kerusakan.includes("tanah");
    let hasMck = kerusakan.includes("mck") || kerusakan.includes("jamban") || kerusakan.includes("sanitasi");

    if (hasAtap) score += 8;
    if (hasDinding) score += 8;
    if (hasLantai) score += 8;
    if (hasMck) score += 6;

    // Prioritas Kategori
    let priorityCode = "P3";
    let priorityLabel = "Prioritas 3 (Sedang)";
    let priorityBadgeClass = "badge-p3";

    if (score >= 75) {
      priorityCode = "P1";
      priorityLabel = "Prioritas 1 (Sangat Tinggi)";
      priorityBadgeClass = "badge-p1";
    } else if (score >= 55) {
      priorityCode = "P2";
      priorityLabel = "Prioritas 2 (Tinggi)";
      priorityBadgeClass = "badge-p2";
    } else if (score < 40) {
      priorityCode = "P4";
      priorityLabel = "Perlu Verifikasi Lapangan";
      priorityBadgeClass = "badge-p4";
    }

    return {
      ...record,
      score,
      priorityCode,
      priorityLabel,
      priorityBadgeClass,
      hasAtap,
      hasDinding,
      hasLantai,
      hasMck
    };
  }

  /* ================= AUTO REFRESH & MANUAL REFRESH ================= */
  setupAutoRefresh() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    if (this.autoRefreshIntervalMs > 0) {
      this.autoRefreshTimer = setInterval(() => {
        if (this.dataSource === "live") {
          this.refreshData(false);
        }
      }, this.autoRefreshIntervalMs);
    }
  }

  async refreshData(showIndicator = true) {
    try {
      await this.fetchGoogleSheetData(showIndicator);
      if (this.dataSource === "live") {
        this.rawData = [...this.liveSheetData];
        this.applyFilters();
      }
      this.updateLastSyncDisplay();
    } catch (e) {
      console.warn("Refresh error:", e);
    }
  }

  updateLastSyncDisplay() {
    const syncTimeEl = document.getElementById("sync-time");
    if (!syncTimeEl) return;
    const now = this.lastSyncTime || new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    syncTimeEl.textContent = timeStr;
  }

  /* ================= FILTERING & SEARCH ENGINE ================= */
  handleSearch(query) {
    this.searchQuery = (query || "").trim().toLowerCase();
    const btnClear = document.getElementById("btn-clear-search");
    if (btnClear) {
      if (this.searchQuery) {
        btnClear.classList.remove("hidden");
      } else {
        btnClear.classList.add("hidden");
      }
    }
    this.currentPage = 1;
    this.applyFilters();
  }

  clearSearch() {
    const input = document.getElementById("search-input");
    if (input) input.value = "";
    this.handleSearch("");
  }

  handleFilterChange() {
    const kabEl = document.getElementById("filter-kabupaten");
    this.filters.kabupaten = kabEl ? kabEl.value : "";
    this.filters.kecamatan = document.getElementById("filter-kecamatan").value;
    this.filters.desa = document.getElementById("filter-desa").value;
    this.filters.desil = document.getElementById("filter-desil").value;
    this.filters.lahan = document.getElementById("filter-lahan").value;
    this.filters.prioritas = document.getElementById("filter-prioritas").value;

    this.updateKecamatanFilterDropdown();
    this.currentPage = 1;
    this.applyFilters();
  }

  resetFilters() {
    this.searchQuery = "";
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    
    const kabEl = document.getElementById("filter-kabupaten");
    if (kabEl) kabEl.value = "";
    document.getElementById("filter-kecamatan").value = "";
    document.getElementById("filter-desa").value = "";
    document.getElementById("filter-desil").value = "";
    document.getElementById("filter-lahan").value = "";
    document.getElementById("filter-prioritas").value = "";

    this.filters = { kabupaten: "", kecamatan: "", desa: "", desil: "", lahan: "", prioritas: "" };
    this.updateKecamatanFilterDropdown();
    this.currentPage = 1;
    this.applyFilters();
  }

  updateKabupatenFilterDropdown() {
    const sel = document.getElementById("filter-kabupaten");
    if (!sel) return;
    const currentVal = sel.value;
    const kabupatens = Array.from(new Set(this.rawData.map(r => r.kabupatenKota).filter(Boolean))).sort();
    
    sel.innerHTML = '<option value="">Semua Kabupaten/Kota</option>';
    kabupatens.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      if (k === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });

    this.updateKecamatanFilterDropdown();
  }

  updateKecamatanFilterDropdown() {
    const sel = document.getElementById("filter-kecamatan");
    if (!sel) return;
    const currentVal = sel.value;
    const selectedKab = this.filters.kabupaten;

    let items = this.rawData;
    if (selectedKab) {
      items = items.filter(r => (r.kabupatenKota || "").toLowerCase() === selectedKab.toLowerCase());
    }

    const kecamatans = Array.from(new Set(items.map(r => r.kecamatan).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Semua Kecamatan</option>';
    kecamatans.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      if (k === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });

    this.updateDesaFilterDropdown();
  }

  updateDesaFilterDropdown() {
    const sel = document.getElementById("filter-desa");
    if (!sel) return;
    const currentVal = sel.value;
    const selectedKab = this.filters.kabupaten;
    const selectedKec = this.filters.kecamatan;

    let items = this.rawData;
    if (selectedKab) {
      items = items.filter(r => (r.kabupatenKota || "").toLowerCase() === selectedKab.toLowerCase());
    }
    if (selectedKec) {
      items = items.filter(r => (r.kecamatan || "").toLowerCase() === selectedKec.toLowerCase());
    }

    const desas = Array.from(new Set(items.map(r => r.kelurahanDesa).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Semua Desa</option>';
    desas.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  applyFilters() {
    let result = [...this.rawData];

    // Global Search
    if (this.searchQuery) {
      const q = this.searchQuery;
      result = result.filter(r => {
        return (
          (r.namaPenerima && r.namaPenerima.toLowerCase().includes(q)) ||
          (r.nik && r.nik.toLowerCase().includes(q)) ||
          (r.kabupatenKota && r.kabupatenKota.toLowerCase().includes(q)) ||
          (r.kelurahanDesa && r.kelurahanDesa.toLowerCase().includes(q)) ||
          (r.kecamatan && r.kecamatan.toLowerCase().includes(q)) ||
          (r.alamat && r.alamat.toLowerCase().includes(q)) ||
          (r.namaPengusul && r.namaPengusul.toLowerCase().includes(q))
        );
      });
    }

    // Kabupaten / Kota
    if (this.filters.kabupaten) {
      result = result.filter(r => (r.kabupatenKota || "").toLowerCase() === this.filters.kabupaten.toLowerCase());
    }

    // Kecamatan
    if (this.filters.kecamatan) {
      result = result.filter(r => (r.kecamatan || "").toLowerCase() === this.filters.kecamatan.toLowerCase());
    }

    // Desa
    if (this.filters.desa) {
      result = result.filter(r => (r.kelurahanDesa || "").toLowerCase() === this.filters.desa.toLowerCase());
    }

    // Desil
    if (this.filters.desil) {
      result = result.filter(r => (r.hasilDesil || "").toLowerCase().includes(this.filters.desil.toLowerCase()));
    }

    // Status Lahan
    if (this.filters.lahan) {
      result = result.filter(r => (r.statusLahan || "").toLowerCase().includes(this.filters.lahan.toLowerCase()));
    }

    // Prioritas
    if (this.filters.prioritas) {
      result = result.filter(r => r.priorityCode === this.filters.prioritas);
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[this.sortField] || "";
      let valB = b[this.sortField] || "";

      if (this.sortField === "score") {
        return this.sortOrder === "asc" ? a.score - b.score : b.score - a.score;
      }

      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return this.sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return this.sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    this.filteredData = result;
    this.renderKPIs();
    this.renderCharts();
    this.renderTable();
  }

  sortTable(field) {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortOrder = "desc";
    }
    this.applyFilters();
  }

  /* ================= EXECUTIVE KPI CARDS ================= */
  renderKPIs() {
    const total = this.rawData.length;
    const desilEkstrem = this.rawData.filter(r => {
      const d = (r.hasilDesil || "").toLowerCase();
      return d.includes("desil 1") || d.includes("desil 2") || d.includes("1") || d.includes("2");
    }).length;

    const lahanSendiri = this.rawData.filter(r => {
      const l = (r.statusLahan || "").toLowerCase();
      return l.includes("sendiri") || l.includes("shm") || l.includes("girik") || l.includes("hibah") || l.includes("sertifikat");
    }).length;

    const rusakAladin = this.rawData.filter(r => r.hasAtap || (r.hasDinding && r.hasLantai)).length;
    const mckRusak = this.rawData.filter(r => r.hasMck).length;

    const kabupatens = new Set(this.rawData.map(r => r.kabupatenKota).filter(Boolean));
    const kecamatans = new Set(this.rawData.map(r => r.kecamatan).filter(Boolean));
    const desas = new Set(this.rawData.map(r => r.kelurahanDesa).filter(Boolean));

    // Update Elements
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-desil-ekstrem").textContent = desilEkstrem;
    document.getElementById("stat-desil-pct").textContent = total > 0 ? `(${Math.round((desilEkstrem / total) * 100)}%)` : "(0%)";
    document.getElementById("stat-lahan-sendiri").textContent = lahanSendiri;
    document.getElementById("stat-lahan-pct").textContent = total > 0 ? `(${Math.round((lahanSendiri / total) * 100)}%)` : "(0%)";
    document.getElementById("stat-rusak-aladin").textContent = rusakAladin;
    document.getElementById("stat-mck-rusak").textContent = mckRusak;
    document.getElementById("stat-mck-pct").textContent = total > 0 ? `(${Math.round((mckRusak / total) * 100)}%)` : "(0%)";
    document.getElementById("stat-wilayah").textContent = `${kabupatens.size} Kab / ${kecamatans.size} Kec`;
  }

  /* ================= LAPORAN KABUPATEN / KOTA YANG MASUK ================= */
  renderCharts() {
    this.renderKabupatenReport();
  }

  renderKabupatenReport() {
    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    const data = this.filteredData;
    const allData = this.rawData;

    // Rekapitulasi per Kabupaten
    const kabMap = {};
    allData.forEach(r => {
      const kab = r.kabupatenKota || "Kendari";
      if (!kabMap[kab]) {
        kabMap[kab] = {
          name: kab,
          total: 0,
          filteredTotal: 0,
          kecamatans: new Set(),
          desil12: 0,
          p1: 0
        };
      }
      kabMap[kab].total++;
      if (r.kecamatan) kabMap[kab].kecamatans.add(r.kecamatan);
      const d = (r.hasilDesil || "").toLowerCase();
      if (d.includes("1") || d.includes("2")) kabMap[kab].desil12++;
      if (r.priorityCode === "P1") kabMap[kab].p1++;
    });

    data.forEach(r => {
      const kab = r.kabupatenKota || "Kendari";
      if (kabMap[kab]) {
        kabMap[kab].filteredTotal++;
      }
    });

    const kabList = Object.values(kabMap).sort((a, b) => b.total - a.total);

    // Update Badge Total Kabupaten
    const badgeTotal = document.getElementById("badge-total-kabupaten");
    if (badgeTotal) {
      badgeTotal.textContent = `${kabList.length} Kabupaten / Kota Terdata`;
    }

    // Render Cards
    const cardsContainer = document.getElementById("kabupaten-cards-container");
    if (cardsContainer) {
      if (kabList.length === 0) {
        cardsContainer.innerHTML = '<div class="text-xs text-slate-400 p-4 text-center">Belum ada data kabupaten masuk.</div>';
      } else {
        let cardsHtml = "";
        kabList.forEach(k => {
          const isSelected = this.filters.kabupaten && this.filters.kabupaten.toLowerCase() === k.name.toLowerCase();
          cardsHtml += `
            <div onclick="app.selectKabupatenFilter('${this.escapeHTML(k.name)}')" 
                 class="p-3.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-950/40 shadow-sm' : 'border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-brand-400 hover:shadow-xs'}">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300 flex items-center justify-center text-xs font-bold">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h4 class="font-bold text-xs text-slate-800 dark:text-white leading-tight">${this.escapeHTML(k.name)}</h4>
                    <span class="text-[10px] text-slate-400">${k.kecamatans.size} Kecamatan tercover</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-base font-black text-brand-600 dark:text-brand-400">${k.total}</span>
                  <span class="text-[10px] text-slate-400 block -mt-0.5">Usulan</span>
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span class="text-slate-500 dark:text-slate-400">
                  <span class="text-rose-600 font-semibold">${k.desil12}</span> Desil Ekstrem
                </span>
                <span class="text-brand-600 dark:text-brand-400 font-semibold flex items-center hover:underline">
                  ${isSelected ? 'Tampilkan Semua &times;' : 'Filter Tabel &rarr;'}
                </span>
              </div>
            </div>
          `;
        });
        cardsContainer.innerHTML = cardsHtml;
      }
    }

    // Render Chart Kabupaten
    const chartLabels = kabList.map(k => k.name);
    const chartValues = kabList.map(k => (this.filters.kabupaten ? k.filteredTotal : k.total));

    this.createOrUpdateChart("chart-kabupaten", {
      type: "bar",
      data: {
        labels: chartLabels,
        datasets: [{
          label: "Jumlah Usulan RTLH",
          data: chartValues,
          backgroundColor: ["#0d9488", "#0284c7", "#f59e0b", "#6366f1", "#10b981", "#ec4899"],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const kabName = chartLabels[index];
            this.selectKabupatenFilter(kabName);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} Usulan Masuk`
            }
          }
        },
        scales: {
          x: { 
            ticks: { color: textColor, font: { weight: "bold" } }, 
            grid: { display: false } 
          },
          y: { 
            ticks: { color: textColor, stepSize: 1 }, 
            grid: { color: gridColor },
            beginAtZero: true
          }
        }
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  selectKabupatenFilter(kabName) {
    const sel = document.getElementById("filter-kabupaten");
    if (!sel) return;
    if (this.filters.kabupaten && this.filters.kabupaten.toLowerCase() === kabName.toLowerCase()) {
      sel.value = "";
    } else {
      sel.value = kabName;
    }
    this.handleFilterChange();
  }

  createOrUpdateChart(id, config) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (this.charts[id]) {
      this.charts[id].destroy();
    }
    this.charts[id] = new Chart(ctx, config);
  }

  /* ================= DATA TABLE & PAGINATION ================= */
  renderTable() {
    const tbody = document.getElementById("table-body");
    const emptyState = document.getElementById("table-empty-state");
    const countBadge = document.getElementById("table-record-count");
    if (!tbody) return;

    countBadge.textContent = `${this.filteredData.length} Usulan`;

    if (this.filteredData.length === 0) {
      tbody.innerHTML = "";
      emptyState.classList.remove("hidden");
      this.renderPagination(0);
      return;
    }

    emptyState.classList.add("hidden");

    // Pagination Slice
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredData.length);
    const pageRecords = this.filteredData.slice(startIndex, endIndex);

    let html = "";
    pageRecords.forEach((item, index) => {
      const rowNo = startIndex + index + 1;
      const maskedNIK = this.maskNIKString(item.nik);
      const shortDate = item.timestamp ? item.timestamp.substring(0, 10) : "-";

      // Damage pills
      let damagePills = "";
      if (item.hasAtap) damagePills += '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 mr-1 text-[10px]">Atap</span>';
      if (item.hasDinding) damagePills += '<span class="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 mr-1 text-[10px]">Dinding</span>';
      if (item.hasLantai) damagePills += '<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 mr-1 text-[10px]">Lantai</span>';
      if (item.hasMck) damagePills += '<span class="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 text-[10px]">MCK</span>';

      html += `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
          <td class="py-3 px-4 text-center font-medium text-slate-400">${rowNo}</td>
          <td class="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">${shortDate}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900 dark:text-white">${this.escapeHTML(item.namaPenerima)}</div>
            <div class="text-[11px] font-mono text-slate-400">${maskedNIK}</div>
          </td>
          <td class="py-3 px-4">
            <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 mb-0.5">
              ${this.escapeHTML(item.kabupatenKota || "Kendari")}
            </span>
            <div class="font-semibold text-slate-800 dark:text-slate-200">${this.escapeHTML(item.kecamatan)}</div>
            <div class="text-[11px] text-slate-500">${this.escapeHTML(item.kelurahanDesa)}</div>
          </td>
          <td class="py-3 px-4">
            <div class="text-slate-700 dark:text-slate-300">${this.escapeHTML(item.pekerjaan)}</div>
            <span class="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              ${this.escapeHTML(item.penghasilanUmp)}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center space-x-1.5">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${item.priorityBadgeClass}">
                ${item.priorityCode}
              </span>
              <span class="text-[11px] text-slate-600 dark:text-slate-300 font-medium">${this.escapeHTML(item.hasilDesil)}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">Skor: ${item.score}/100</div>
          </td>
          <td class="py-3 px-4">
            <div class="font-medium text-slate-800 dark:text-slate-200">${this.escapeHTML(item.statusLahan)}</div>
            <div class="text-[11px] text-slate-400">Luas: ${this.escapeHTML(item.luasTanah || "-")}</div>
          </td>
          <td class="py-3 px-4">
            <div class="flex flex-wrap gap-1">${damagePills || '<span class="text-slate-400">-</span>'}</div>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center space-x-1">
              ${item.fotoDepan ? `<img src="${item.fotoDepan}" class="w-7 h-7 rounded object-cover border border-slate-200 shadow-xs cursor-pointer hover:scale-110 transition-all" onclick="app.zoomPhotoDirect('${item.fotoDepan}', 'Tampak Depan - ${this.escapeHTML(item.namaPenerima)}')">` : '<span class="text-[10px] text-slate-400">No Foto</span>'}
              ${item.ktpUrl ? `<span title="KTP Terlampir" class="text-emerald-600"><i data-lucide="file-check" class="w-3.5 h-3.5 inline"></i></span>` : ''}
            </div>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <div class="flex items-center justify-center space-x-1">
              <button onclick="app.openDetailModal(${startIndex + index})" class="p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 transition-all" title="Lihat Profil Lengkap">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              </button>
              ${item.noHpWa && item.noHpWa !== "-" ? `
                <a href="${this.getWhatsAppLink(item.noHpWa, item.namaPenerima)}" target="_blank" class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 transition-all" title="Hubungi WhatsApp">
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                </a>
              ` : ''}
              <button onclick="app.printSingleRecordVerificationDirect(${startIndex + index})" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 transition-all" title="Cetak Berita Acara">
                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    this.renderPagination(this.filteredData.length);
    if (window.lucide) window.lucide.createIcons();
  }

  renderPagination(totalRecords) {
    const info = document.getElementById("pagination-info");
    const container = document.getElementById("pagination-buttons");
    if (!info || !container) return;

    if (totalRecords === 0) {
      info.textContent = "Menampilkan 0 dari 0 data";
      container.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(totalRecords / this.pageSize);
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, totalRecords);

    info.textContent = `Menampilkan ${start} - ${end} dari ${totalRecords} usulan`;

    let btns = "";
    // Previous button
    btns += `
      <button onclick="app.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700">
        &laquo;
      </button>
    `;

    // Page numbers
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 1 && p <= this.currentPage + 1)) {
        btns += `
          <button onclick="app.goToPage(${p})" class="px-2.5 py-1 rounded-lg ${p === this.currentPage ? 'bg-brand-600 text-white font-bold' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}">
            ${p}
          </button>
        `;
      } else if (p === this.currentPage - 2 || p === this.currentPage + 2) {
        btns += `<span class="px-1 text-slate-400">...</span>`;
      }
    }

    // Next button
    btns += `
      <button onclick="app.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700">
        &raquo;
      </button>
    `;

    container.innerHTML = btns;
  }

  goToPage(p) {
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    if (p < 1 || p > totalPages) return;
    this.currentPage = p;
    this.renderTable();
  }

  changePageSize(newSize) {
    this.pageSize = parseInt(newSize, 10) || 10;
    this.currentPage = 1;
    this.renderTable();
  }

  /* ================= MODAL: DETAIL PROFIL RTLH ================= */
  openDetailModal(index) {
    const item = this.filteredData[index];
    if (!item) return;
    this.selectedRecord = item;

    document.getElementById("detail-priority-badge").className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${item.priorityBadgeClass}`;
    document.getElementById("detail-priority-badge").textContent = item.priorityLabel;

    document.getElementById("detail-desil-badge").textContent = item.hasilDesil || "Desil -";
    document.getElementById("detail-timestamp").textContent = item.timestamp ? `Diinput: ${item.timestamp}` : "";
    document.getElementById("detail-nama").textContent = item.namaPenerima;
    document.getElementById("detail-lokasi-text").textContent = `${item.kelurahanDesa}, Kec. ${item.kecamatan}, ${item.kabupatenKota}`;

    // Biodata Tab
    document.getElementById("detail-nik").textContent = this.isMaskNIK ? this.maskNIKString(item.nik) : item.nik;
    document.getElementById("detail-ttl").textContent = item.ttl || "-";
    document.getElementById("detail-pekerjaan").textContent = item.pekerjaan || "-";
    document.getElementById("detail-nohp").textContent = item.noHpWa || "-";
    document.getElementById("detail-penghasilan").textContent = item.penghasilanUmp || "-";
    document.getElementById("detail-cek-desil").textContent = item.cekStatusDesil || "-";
    document.getElementById("detail-hasil-desil").textContent = item.hasilDesil || "-";
    document.getElementById("detail-pengusul").textContent = item.namaPengusul || "-";
    document.getElementById("detail-kabupaten").textContent = item.kabupatenKota || "-";
    document.getElementById("detail-kecamatan").textContent = item.kecamatan || "-";
    document.getElementById("detail-desa").textContent = item.kelurahanDesa || "-";
    document.getElementById("detail-alamat").textContent = item.alamat || "-";

    const btnWa = document.getElementById("detail-btn-wa");
    const btnWaAction = document.getElementById("btn-wa-action");
    const waLink = this.getWhatsAppLink(item.noHpWa, item.namaPenerima);
    if (btnWa) btnWa.href = waLink;
    if (btnWaAction) btnWaAction.href = waLink;

    // Fisik Tab
    document.getElementById("detail-bagian-kerusakan").textContent = item.bagianKerusakan || "Tidak ada rincian kerusakan tambahan.";
    document.getElementById("detail-status-lahan").textContent = item.statusLahan || "-";
    document.getElementById("detail-luas-tanah").textContent = item.luasTanah || "-";

    // Checklist Colors
    this.updateChecklistBadge("check-atap", item.hasAtap);
    this.updateChecklistBadge("check-dinding", item.hasDinding);
    this.updateChecklistBadge("check-lantai", item.hasLantai);
    this.updateChecklistBadge("check-mck", item.hasMck);

    // Foto Tab
    this.setModalPhoto("detail-foto-depan", item.fotoDepan);
    this.setModalPhoto("detail-foto-belakang", item.fotoBelakang);
    this.setModalPhoto("detail-foto-samping", item.fotoSamping);
    this.setModalPhoto("detail-foto-mck", item.fotoMck);

    // Dokumen Tab
    this.setDocLink("link-dok-ktp", "status-dok-ktp", item.ktpUrl);
    this.setDocLink("link-dok-kk", "status-dok-kk", item.kkUrl);
    this.setDocLink("link-dok-tanah", "status-dok-tanah", item.sertifikatUrl);

    this.switchDetailTab("tab-bio");
    document.getElementById("modal-detail").classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  updateChecklistBadge(elId, isDamaged) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (isDamaged) {
      el.className = "p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200";
    } else {
      el.className = "p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500";
    }
  }

  setModalPhoto(imgId, src) {
    const img = document.getElementById(imgId);
    if (!img) return;
    if (src) {
      img.src = src;
      img.parentElement.classList.remove("opacity-50", "pointer-events-none");
    } else {
      img.src = "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&auto=format&fit=crop&q=80";
      img.parentElement.classList.add("opacity-50");
    }
  }

  setDocLink(linkId, statusId, url) {
    const link = document.getElementById(linkId);
    const status = document.getElementById(statusId);
    if (!link || !status) return;
    if (url) {
      link.href = url;
      link.classList.remove("hidden");
      status.textContent = "Berkas Tersedia";
      status.className = "text-[11px] text-emerald-600 font-semibold";
    } else {
      link.classList.add("hidden");
      status.textContent = "Belum Diunggah";
      status.className = "text-[11px] text-slate-400 font-medium";
    }
  }

  closeDetailModal() {
    document.getElementById("modal-detail").classList.add("hidden");
  }

  switchDetailTab(tabId) {
    ["tab-bio", "tab-fisik", "tab-foto", "tab-dokumen"].forEach(t => {
      const el = document.getElementById(t);
      const nav = document.getElementById(`nav-${t}`);
      if (el) el.classList.add("hidden");
      if (nav) {
        nav.className = "py-3 px-3 border-b-2 border-transparent hover:text-slate-700 dark:hover:text-slate-200 flex items-center space-x-1.5";
      }
    });

    const activeEl = document.getElementById(tabId);
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeEl) activeEl.classList.remove("hidden");
    if (activeNav) {
      activeNav.className = "py-3 px-3 border-b-2 border-brand-600 text-brand-600 flex items-center space-x-1.5 font-bold";
    }
  }

  toggleMaskNIK() {
    this.isMaskNIK = !this.isMaskNIK;
    const btnIcon = document.getElementById("btn-mask-icon");
    const nikEl = document.getElementById("detail-nik");
    if (!this.selectedRecord) return;
    
    if (this.isMaskNIK) {
      nikEl.textContent = this.maskNIKString(this.selectedRecord.nik);
      if (btnIcon) btnIcon.setAttribute("data-lucide", "eye");
    } else {
      nikEl.textContent = this.selectedRecord.nik;
      if (btnIcon) btnIcon.setAttribute("data-lucide", "eye-off");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  maskNIKString(nik) {
    if (!nik || nik.length < 8) return nik || "-";
    return nik.substring(0, 6) + "******" + nik.substring(nik.length - 4);
  }

  /* ================= LIGHTBOX PHOTO ZOOM ================= */
  zoomPhoto(side) {
    if (!this.selectedRecord) return;
    let url = "";
    let caption = "";
    if (side === "depan") {
      url = this.selectedRecord.fotoDepan;
      caption = `Foto Tampak Depan - ${this.selectedRecord.namaPenerima}`;
    } else if (side === "belakang") {
      url = this.selectedRecord.fotoBelakang;
      caption = `Foto Tampak Belakang - ${this.selectedRecord.namaPenerima}`;
    } else if (side === "samping") {
      url = this.selectedRecord.fotoSamping;
      caption = `Foto Tampak Samping - ${this.selectedRecord.namaPenerima}`;
    } else if (side === "mck") {
      url = this.selectedRecord.fotoMck;
      caption = `Foto Sanitasi / MCK - ${this.selectedRecord.namaPenerima}`;
    }
    this.zoomPhotoDirect(url, caption);
  }

  zoomPhotoDirect(url, caption) {
    if (!url) return;
    const modal = document.getElementById("modal-lightbox");
    const img = document.getElementById("lightbox-img");
    const cap = document.getElementById("lightbox-caption");
    if (!modal || !img) return;

    img.src = url;
    cap.textContent = caption || "Pratinjau Foto Rumah RTLH";
    modal.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  closeLightbox() {
    document.getElementById("modal-lightbox").classList.add("hidden");
  }

  /* ================= SETTINGS MODAL ================= */
  openSettingsModal() {
    document.getElementById("config-sheet-id").value = this.sheetId;
    document.getElementById("config-sheet-gid").value = this.sheetGid;
    document.getElementById("config-auto-refresh").value = this.autoRefreshIntervalMs;
    document.getElementById("modal-settings").classList.remove("hidden");
  }

  closeSettingsModal() {
    document.getElementById("modal-settings").classList.add("hidden");
  }

  saveConfig() {
    const sid = document.getElementById("config-sheet-id").value.trim();
    const gid = document.getElementById("config-sheet-gid").value.trim();
    const interval = parseInt(document.getElementById("config-auto-refresh").value, 10);

    if (sid) this.sheetId = sid;
    if (gid) this.sheetGid = gid;
    this.autoRefreshIntervalMs = isNaN(interval) ? 60000 : interval;

    this.setupAutoRefresh();
    this.closeSettingsModal();
    this.refreshData(true);
  }

  /* ================= EXPORT & PRINT FEATURES ================= */
  exportExcel() {
    if (!window.XLSX) {
      alert("Pustaka XLSX sedang dimuat, silakan coba sesaat lagi.");
      return;
    }

    const exportRows = this.filteredData.map((r, i) => ({
      "No": i + 1,
      "Waktu Pengusulan": r.timestamp,
      "Kabupaten/Kota": r.kabupatenKota,
      "Kecamatan": r.kecamatan,
      "Kelurahan/Desa": r.kelurahanDesa,
      "Nama Calon Penerima": r.namaPenerima,
      "NIK": r.nik,
      "Tempat, Tanggal Lahir": r.ttl,
      "Pekerjaan": r.pekerjaan,
      "Nomor HP / WA": r.noHpWa,
      "Alamat Lengkap": r.alamat,
      "Penghasilan < UMP": r.penghasilanUmp,
      "Hasil Desil": r.hasilDesil,
      "Skor Kelayakan": r.score,
      "Prioritas": r.priorityCode,
      "Status Lahan": r.statusLahan,
      "Luas Tanah": r.luasTanah,
      "Bagian Kerusakan": r.bagianKerusakan,
      "Nama Pengusul": r.namaPengusul
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekapitulasi RTLH");

    const dateStr = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `Rekap_Monitoring_RTLH_${dateStr}.xlsx`);
  }

  exportCSV() {
    const headers = [
      "No", "Waktu Pengusulan", "Kabupaten/Kota", "Kecamatan", "Kelurahan/Desa",
      "Nama Calon Penerima", "NIK", "Pekerjaan", "No HP/WA", "Alamat Lengkap",
      "Hasil Desil", "Skor", "Prioritas", "Status Lahan", "Luas Tanah", "Bagian Kerusakan", "Nama Pengusul"
    ];

    const rows = this.filteredData.map((r, i) => [
      i + 1,
      `"${r.timestamp || ""}"`,
      `"${r.kabupatenKota || ""}"`,
      `"${r.kecamatan || ""}"`,
      `"${r.kelurahanDesa || ""}"`,
      `"${(r.namaPenerima || "").replace(/"/g, '""')}"`,
      `"'${r.nik || ""}"`,
      `"${(r.pekerjaan || "").replace(/"/g, '""')}"`,
      `"'${r.noHpWa || ""}"`,
      `"${(r.alamat || "").replace(/"/g, '""')}"`,
      `"${r.hasilDesil || ""}"`,
      r.score || 0,
      `"${r.priorityCode || ""}"`,
      `"${r.statusLahan || ""}"`,
      `"${r.luasTanah || ""}"`,
      `"${(r.bagianKerusakan || "").replace(/"/g, '""')}"`,
      `"${(r.namaPengusul || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Rekap_Monitoring_RTLH_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printSummaryReport() {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    let tableRows = "";
    this.filteredData.forEach((r, i) => {
      tableRows += `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td><b>${this.escapeHTML(r.namaPenerima)}</b><br><small>NIK: ${r.nik}</small></td>
          <td>${this.escapeHTML(r.kecamatan)} / ${this.escapeHTML(r.kelurahanDesa)}</td>
          <td>${this.escapeHTML(r.hasilDesil)}<br><small>Skor: ${r.score}</small></td>
          <td><b>${r.priorityCode}</b></td>
          <td>${this.escapeHTML(r.statusLahan)} (${r.luasTanah || "-"})</td>
          <td><small>${this.escapeHTML(r.bagianKerusakan)}</small></td>
          <td>${this.escapeHTML(r.namaPengusul)}</td>
        </tr>
      `;
    });

    printArea.innerHTML = `
      <div class="print-kop">
        <h1>PEMERINTAH DAERAH KABUPATEN / KOTA</h1>
        <h2>DINAS PERUMAHAN, KAWASAN PERMUKIMAN DAN PERTANAHAN</h2>
        <p>SISTEM INFORMASI & MONITORING RUMAH TIDAK LAYAK HUNI (SIP-RLTH)</p>
      </div>

      <div style="margin-bottom: 15px; font-size: 10pt;">
        <b>LAPORAN REKAPITULASI HASIL USULAN & VERIFIKASI BANTUAN RTLH</b><br>
        Tanggal Cetak: ${todayStr} | Total Usulan Terdaftar: ${this.filteredData.length} Rumah
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="width:30px; text-align:center;">No</th>
            <th>Calon Penerima Manfaat</th>
            <th>Kecamatan / Desa</th>
            <th>Desil Kemiskinan</th>
            <th>Prioritas</th>
            <th>Status Tanah</th>
            <th>Kerusakan ALADIN</th>
            <th>Pengusul / TFL</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="print-signature-box">
        <div class="signature-column">
          <p>Mengetahui,<br><b>Kepala Desa / Lurah</b></p>
          <div class="signature-space"></div>
          <p>( .................................................... )</p>
        </div>
        <div class="signature-column">
          <p>Diverifikasi Oleh,<br><b>Tenaga Fasilitator Lapangan (TFL)</b></p>
          <div class="signature-space"></div>
          <p>( .................................................... )</p>
        </div>
        <div class="signature-column">
          <p>Kabupaten/Kota, ${todayStr}<br><b>Koordinator Wilayah RTLH</b></p>
          <div class="signature-space"></div>
          <p>( .................................................... )</p>
        </div>
      </div>
    `;

    window.print();
  }

  printSingleRecordVerificationDirect(index) {
    this.selectedRecord = this.filteredData[index];
    this.printSingleRecordVerification();
  }

  printSingleRecordVerification() {
    const item = this.selectedRecord;
    if (!item) return;
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    printArea.innerHTML = `
      <div class="print-kop">
        <h1>PEMERINTAH DAERAH KABUPATEN / KOTA</h1>
        <h2>DINAS PERUMAHAN, KAWASAN PERMUKIMAN DAN PERTANAHAN</h2>
        <p>BERITA ACARA VERIFIKASI LAPANGAN CALON PENERIMA BANTUAN RTLH</p>
      </div>

      <div style="margin-bottom: 20px; font-size: 10pt; line-height: 1.6;">
        <table style="width:100%; border:none; font-size:10pt;">
          <tr><td style="width:200px;"><b>Nomor Registrasi Form</b></td><td>: REG-RTLH-${item.nik ? item.nik.substring(nik => nik.length - 6) : "001"}</td></tr>
          <tr><td><b>Waktu Pengusulan</b></td><td>: ${item.timestamp || "-"}</td></tr>
          <tr><td><b>Tingkat Prioritas</b></td><td>: <b>${item.priorityLabel} (Skor: ${item.score}/100)</b></td></tr>
        </table>
      </div>

      <h3 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:3px; margin-top:15px;">I. IDENTITAS CALON PENERIMA MANFAAT</h3>
      <table style="width:100%; font-size:9.5pt; margin-bottom:15px;">
        <tr><td style="width:200px;">Nama Lengkap</td><td>: <b>${item.namaPenerima}</b></td></tr>
        <tr><td>Nomor Induk Kependudukan (NIK)</td><td>: ${item.nik}</td></tr>
        <tr><td>Tempat, Tanggal Lahir</td><td>: ${item.ttl || "-"}</td></tr>
        <tr><td>Pekerjaan Pokok</td><td>: ${item.pekerjaan || "-"}</td></tr>
        <tr><td>Penghasilan Bulanan</td><td>: ${item.penghasilanUmp || "-"}</td></tr>
        <tr><td>Status Desil Kemiskinan</td><td>: ${item.hasilDesil || "-"} (${item.cekStatusDesil || "-"})</td></tr>
        <tr><td>Nomor HP / WhatsApp</td><td>: ${item.noHpWa || "-"}</td></tr>
        <tr><td>Alamat Lengkap Rumah</td><td>: ${item.alamat}, Desa ${item.kelurahanDesa}, Kec. ${item.kecamatan}, ${item.kabupatenKota}</td></tr>
      </table>

      <h3 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:3px; margin-top:15px;">II. STATUS LAHAN & LEGALITAS</h3>
      <table style="width:100%; font-size:9.5pt; margin-bottom:15px;">
        <tr><td style="width:200px;">Status Kepemilikan Tanah</td><td>: <b>${item.statusLahan}</b></td></tr>
        <tr><td>Perkiraan Luas Tanah / Rumah</td><td>: ${item.luasTanah || "-"}</td></tr>
        <tr><td>Kelengkapan Berkas Identitas</td><td>: KTP: ${item.ktpUrl ? "Ada" : "Belum Ada"} | KK: ${item.kkUrl ? "Ada" : "Belum Ada"} | Bukti Tanah: ${item.sertifikatUrl ? "Ada" : "Belum Ada"}</td></tr>
      </table>

      <h3 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:3px; margin-top:15px;">III. HASIL PENILAIAN KERUSAKAN FISIK RUMAH (ALADIN)</h3>
      <table style="width:100%; font-size:9.5pt; margin-bottom:15px;">
        <tr><td style="width:200px;">Kondisi Atap</td><td>: ${item.hasAtap ? "RUSAK (Bocor parah / Rangka kayu lapuk / Keropos)" : "Layak"}</td></tr>
        <tr><td>Kondisi Dinding</td><td>: ${item.hasDinding ? "RUSAK (Bilik bambu jebol / Papan lapuk / Retak struktur)" : "Layak"}</td></tr>
        <tr><td>Kondisi Lantai</td><td>: ${item.hasLantai ? "RUSAK (Masih tanah / Semen pecah berdebu)" : "Layak"}</td></tr>
        <tr><td>Kondisi Sanitasi / MCK</td><td>: ${item.hasMck ? "TIDAK LAYAK / Belum memiliki jamban keluarga sehat" : "Layak"}</td></tr>
        <tr><td>Rincian Tambahan Lapangan</td><td>: <i>${item.bagianKerusakan || "-"}</i></td></tr>
      </table>

      <div style="margin-top:20px; font-size:9pt; text-align:justify; border:1px solid #000; padding:10px;">
        <b>Catatan Verifikator:</b> Berdasarkan hasil pemeriksaan lapangan dan dokumen, calon penerima dinyatakan 
        <b>${item.score >= 55 ? "MEMENUHI SYARAT KELAYAKAN BANTUAN RTLH" : "PERLU DILAKUKAN VERIFIKASI ULANG"}</b> sesuai dengan petunjuk teknis pelaksanaan program bantuan perumahan swadaya.
      </div>

      <div class="print-signature-box" style="margin-top:40px;">
        <div class="signature-column">
          <p>Calon Penerima Bantuan,</p>
          <div class="signature-space"></div>
          <p><b>( ${item.namaPenerima} )</b></p>
        </div>
        <div class="signature-column">
          <p>Petugas Surveyor / Pengusul,</p>
          <div class="signature-space"></div>
          <p><b>( ${item.namaPengusul || "Surveyor Lapangan"} )</b></p>
        </div>
        <div class="signature-column">
          <p>Mengetahui,<br>Kepala Desa / Lurah Setempat,</p>
          <div class="signature-space"></div>
          <p><b>( .................................................... )</b></p>
        </div>
      </div>
    `;

    window.print();
  }

  /* ================= UTILITY HELPERS ================= */
  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getWhatsAppLink(phone, name) {
    if (!phone || phone === "-") return "#";
    let cleaned = phone.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.substring(1);
    }
    const msg = encodeURIComponent(`Halo Bpk/Ibu ${name}, kami dari Tim Verifikasi Program Bantuan RTLH mengenai data usulan perumahan yang telah didaftarkan.`);
    return `https://wa.me/${cleaned}?text=${msg}`;
  }
}

// Instantiate App
window.addEventListener("DOMContentLoaded", () => {
  window.app = new RTLHDashboardApp();
});
