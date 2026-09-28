# SIP-RLTH (Sistem Informasi & Monitoring Rumah Tidak Layak Huni)

Dashboard monitoring interaktif dan eksekutif untuk memantau hasil inputan Google Form **Usulan Rumah Tidak Layak Huni (RTLH)** secara *real-time* langsung dari Google Sheets.

---

## 🌟 Fitur Utama

1. **Sinkronisasi Otomatis Google Sheets (Zero-CORS & Real-Time)**
   - Terhubung langsung dengan Google Sheet formulir usulan RTLH:
     - **Spreadsheet ID**: `1UJ0ypFjBGbxwPgrwXFlValZtijIu7Jf6j0XzlHgFCDc`
     - **Sheet GID**: `1707297001` (*FORMULIR USULAN RUMAH TIDAK LAYAK HUNI (RTLH) (Jawaban)*)
   - Menggunakan teknologi Google Visualization API (JSONP) sehingga berjalan langsung di browser tanpa perlu server proxy backend.
   - Pilihan auto-refresh (30 detik, 1 menit, 5 menit) dan tombol refresh manual.

2. **Mode Data Ganda (Live Sheet & Simulasi Realistis)**
   - **Mode Live**: Membaca respon asli secara langsung saat ada entri baru yang di-submit melalui Google Form.
   - **Mode Simulasi**: Menyediakan 15 sampel data survei lapangan lengkap (nama, NIK, foto rumah 4 sisi, koordinat wilayah Tangerang/Banten, status desil, dan rincian kerusakan) untuk keperluan demonstrasi atau evaluasi fitur sebelum data riil masuk dalam jumlah besar.

3. **Indikator Metrik Eksekutif (KPI Cards)**
   - **Total Usulan Masuk**
   - **Prioritas Ekstrem (Desil 1 & 2 / P3KE / DTKS)**
   - **Lahan Bersertifikat / Milik Sendiri (Clean & Clear)**
   - **Kerusakan Kritis ALADIN (Atap, Lantai & Dinding)**
   - **Kebutuhan Fasilitas Sanitasi / MCK**
   - **Sebaran Wilayah (Jumlah Kecamatan & Desa Terdata)**

4. **Visualisasi Grafik Interaktif (Chart.js)**
   - **Sebaran Usulan per Kecamatan**: Distribusi wilayah calon penerima bantuan.
   - **Distribusi Desil Kemiskinan**: Proporsi Desil 1 s/d Desil 4 dan Non-Desil.
   - **Tingkat Prioritas Kelayakan Bantuan**: Skor pembobotan P1 (Sangat Tinggi), P2 (Tinggi), P3 (Sedang), dan P4.
   - **Frekuensi Kerusakan Komponen ALADIN & MCK**: Visualisasi kerusakan atap, dinding, lantai, dan sanitasi.
   - **Legalitas Status Lahan**: Proporsi kepemilikan (Milik Sendiri/SHM, Hibah, Tanah Keluarga, Menumpang).
   - **Tren Waktu Pengusulan**: Progres submission harian.

5. **Pencarian Global & Multi-Filter Dinamis**
   - Pencarian cepat berdasarkan Nama Penerima, NIK, Desa, Kecamatan, Alamat, atau Petugas Pengusul.
   - Filter bertingkat:
     - Filter Kecamatan
     - Filter Kelurahan / Desa (menyesuaikan otomatis dengan kecamatan yang dipilih)
     - Filter Desil Kemiskinan
     - Filter Status Legalitas Lahan
     - Filter Prioritas RTLH
   - Pengurutan kolom (sorting) dan paginasi yang responsif.

6. **Kartu Profil Lengkap & Lightbox Galeri Foto**
   - Menampilkan biodata lengkap, NIK tersensor (dengan tombol buka/tutup sensor untuk privasi data).
   - Status sosial ekonomi, pekerjaan, dan penghasilan vs UMP.
   - **Galeri Foto 4 Sudut Lapangan**: Tampak Depan, Belakang, Samping, dan MCK dengan fitur zoom lightbox.
   - Tautan langsung ke dokumen persyaratan (KTP, KK, Sertifikat Tanah).
   - Tombol langsung **Chat WhatsApp** ke calon penerima atau petugas pengusul.

7. **Fitur Ekspor & Cetak Berita Acara Resmi**
   - **Ekspor Excel (.xlsx)** via SheetJS untuk kebutuhan arsip dan pelaporan dinas.
   - **Ekspor CSV** untuk integrasi sistem database lain.
   - **Cetak Laporan Rekapitulasi**: Format cetak ramah kertas dengan KOP dinas dan kolom tanda tangan.
   - **Cetak Berita Acara Verifikasi Lapangan RTLH**: Lembar penilaian per calon penerima bantuan lengkap dengan skor kelayakan dan kotak tanda tangan Kepala Desa, TFL, dan Calon Penerima.

8. **Tema Gelap & Terang (Dark / Light Mode)**
   - Tampilan profesional yang dapat beralih otomatis atau manual antara mode gelap dan terang.

---

## 🚀 Cara Menjalankan Dashboard

### Cara 1: Menggunakan File Batch (Paling Mudah di Windows)
Cukup klik ganda (double-click) file:
```
run_dashboard.bat
```
Dashboard akan langsung terbuka di peramban (browser) web default Anda (Google Chrome, Microsoft Edge, Mozilla Firefox, dll.).

### Cara 2: Buka Langsung File HTML
Buka file `index.html` langsung dengan klik kanan -> **Open with** -> **Google Chrome** atau peramban lainnya.

---

## 📁 Struktur Direktori

```
Dashboard Monitoring RLTH/
├── index.html            # Antarmuka utama dashboard monitoring
├── run_dashboard.bat     # File launcher otomatis untuk Windows
├── css/
│   └── styles.css        # Kustomisasi gaya, animasi glassmorphism, dan format cetak resmi
├── js/
│   ├── app.js            # Engine logika utama, parser GViz, kalkulasi skor, filter, & grafik
│   └── sampleData.js     # 15 data survei lapangan realistis RTLH
├── sheet_data.csv        # Salinan cadangan struktur kolom Google Sheet
└── README.md             # Dokumentasi sistem
```

---

## ⚙️ Struktur Data Google Sheet

Dashboard ini memetakan 24 kolom standar formulir usulan RTLH:
1. `Timestamp` (Waktu Pengusulan)
2. `Kabupaten/Kota`
3. `Kecamatan`
4. `Kelurahan/Desa`
5. `Nama Calon Penerima/Penghuni Rumah`
6. `Nomor Induk Kependudukan (NIK)`
7. `Tempat, Tanggal Lahir`
8. `Pekerjaan`
9. `Nomor Telepon/WhatsApp`
10. `Alamat Lengkap`
11. `Penghasilan <UMP/UMK`
12. `Cek Status Desil`
13. `Hasil Cek Desil`
14. `Status lahan`
15. `Luas Tanah`
16. `Upload KTP Calon Penerima`
17. `UPLOAD SERTIFIKAT TANAH / HIBAH / DLL`
18. `Upload Kartu Keluarga (KK)`
19. `Bagian Kerusakan`
20. `Foto Tampak Depan Rumah`
21. `Foto Tampak Belakang Rumah`
22. `Foto Tampak Samping Rumah`
23. `Foto Sisi Lain Rumah/MCK`
24. `Nama Pengusul`

---

## 🌐 Publikasi Online (Opsional)
Jika ingin diakses oleh dinas atau tim lapangan secara publik:
1. Unggah folder proyek ini ke repositori GitHub.
2. Aktifkan **GitHub Pages** melalui menu *Settings > Pages > Deploy from branch (main)*.
3. Dashboard akan langsung aktif dan dapat diakses melalui URL `https://<username>.github.io/<repo-name>/`.
