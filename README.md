# LaunchFuture — Token Generator (Frontend)

Frontend statis untuk membuat (deploy) token ERC20 kustom lewat smart contract
`LFTFactory` milik Anda. Didesain untuk **GitHub Pages** dan langsung dipakai
dari **HP Android** lewat browser bawaan wallet (MetaMask / Trust Wallet /
Rabby Wallet, dll — semua yang punya "in-app browser" / dApp browser).

Saat ini hanya **EVOZ Mainnet (chain id 805)** yang aktif, karena baru itu
yang sudah Anda deploy. Struktur project sudah disiapkan multichain — tinggal
isi alamat kontrak begitu Anda deploy ulang di BSC/ETH/dll.

Tidak ada backend/server sama sekali. Semua transaksi ditandatangani langsung
di wallet pengguna (non-custodial).

## Struktur file

```
├── index.html              ← satu-satunya halaman (form buat token, token saya, jaringan)
├── manifest.json           ← agar bisa "Add to Home screen" di Android (tampil seperti app)
├── css/
│   └── style.css           ← semua styling
├── js/
│   ├── chains.js            ← DAFTAR JARINGAN. Ini yang Anda edit saat menambah chain baru
│   ├── app.js                ← logika: connect wallet, hitung fee, deploy, daftar token
│   └── abi/
│       ├── LFTFactory.json            ← ABI kontrak factory (diambil dari build Remix Anda)
│       ├── LaunchFutureExchange.json  ← ABI exchange (untuk quote harga LFT)
│       └── ERC20Min.json              ← ABI ERC20 minimal (buat baca token yang sudah dibuat)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

Itu **semua** file yang dibutuhkan. Tidak ada `package.json`, tidak ada build
step, tidak ada Node — murni HTML/CSS/JS statis yang dibaca browser. Library
`ethers.js` v6 dimuat langsung dari CDN (`cdn.jsdelivr.net`) di `index.html`.

## Cara kerja alur "Buat Token"

1. Form mengumpulkan konfigurasi (nama, simbol, supply, keamanan, pajak,
   metadata) lalu dirangkai jadi struct `TokenConfig` + `MetadataConfig`
   persis sesuai urutan field di contract `LFTFactory.deployWithNative`.
2. Tombol **"Hitung Biaya Deploy"** memanggil `getDeployFee("NATIVE")` dan
   `quoteNativeFee("NATIVE")` di kontrak — jadi biaya (dalam EVOZ & setara
   LFT) selalu diambil langsung dari on-chain, bukan di-hardcode. Rasio "LFT
   per Native" yang Anda kasih (`0.2`) sudah otomatis terbaca dari
   `LaunchFutureExchange.lftPerNative()` lewat fungsi ini.
3. Tombol **"Deploy Token"** mengirim transaksi `deployWithNative(config,
   metadata)` sambil membayar `value` sebesar fee yang sudah dihitung.
4. Setelah transaksi confirm, link explorer ditampilkan otomatis.

Catatan penting soal kontrak (biar tidak revert saat deploy):
- Total distribusi pajak (`burnShare + marketingShare + ... + charityShare`)
  **wajib tepat 100**, walau semua pajak (buy/sell/transfer) dimatikan. Kalau
  Anda biarkan semua kosong, frontend otomatis mengisi 100% ke Treasury.
- Kalau share tertentu > 0, wallet tujuannya wajib diisi (kalau dikosongkan,
  frontend otomatis pakai wallet Anda sendiri yang sedang connect).
- `buyTax`/`sellTax`/`transferTax` maksimal 25 (`MAX_TAX` di kontrak).
- Semua persen adalah **bilangan bulat langsung** (isi `5` = 5%), bukan basis
  poin.

## Menjalankan di HP Android

Setelah dipublish ke GitHub Pages (lihat langkah di bawah), buka URL-nya
**dari dalam aplikasi wallet**, bukan dari Chrome biasa — karena `window.ethereum`
hanya tersedia di dApp browser wallet:

- **MetaMask app** → tab Browser (ikon kompas di bawah) → ketik URL GitHub Pages Anda.
- **Trust Wallet app** → tab DApps → ketik/tempel URL.

Di sana tombol "Hubungkan" akan memunculkan wallet native, dan jaringan EVOZ
akan otomatis ditambahkan/dipilihkan kalau belum ada di wallet (via
`wallet_addEthereumChain`).

Anda juga bisa tap **"Add to Home Screen"** dari menu browser wallet supaya
ikon LaunchFuture muncul di homescreen HP seperti aplikasi biasa (`manifest.json`
sudah disiapkan untuk ini).

## Deploy ke GitHub Pages

1. Buat repo baru di GitHub, misalnya `launchfuture-app`.
2. Upload semua isi folder ini (bukan folder itu sendiri, tapi isinya) ke
   root repo tersebut — jadi `index.html` ada langsung di root, bukan di
   dalam subfolder.
3. Ke **Settings → Pages** di repo tersebut.
4. Di **Build and deployment**, pilih Source: **Deploy from a branch**, lalu
   branch `main` folder `/ (root)`. Simpan.
5. Tunggu ~1 menit, GitHub akan kasih URL seperti:
   `https://<username-anda>.github.io/launchfuture-app/`
6. Buka URL itu dari dalam browser wallet di HP (lihat bagian di atas).

Tidak perlu `git` di HP — bisa upload lewat web GitHub langsung (drag & drop
file di halaman "Add file → Upload files").

## Menambah jaringan baru nanti (BSC, ETH, Polygon, dst)

Cukup edit satu file: **`js/chains.js`**. Setiap jaringan sudah punya
template siap pakai — tinggal isi 5 alamat kontrak hasil deploy ulang
(`treasury`, `lftToken`, `exchange`, `deployer`, `factory`) dan ubah
`enabled: false` → `enabled: true`. Tidak perlu ubah file lain; halaman utama,
tombol jaringan, dan validasi otomatis mengikuti daftar ini.

```js
56: {
  enabled: true,   // ← ubah ini
  chainIdHex: "0x38",
  name: "BNB Smart Chain",
  shortName: "BSC",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bsc-dataseed.binance.org"],
  blockExplorerUrls: ["https://bscscan.com"],
  contracts: {
    treasury:  "0x...",   // ← isi
    lftToken:  "0x...",
    exchange:  "0x...",
    deployer:  "0x...",
    factory:   "0x..."
  }
}
```

## Kontrak EVOZ Mainnet yang dipakai

| Kontrak | Alamat |
|---|---|
| Treasury | `0x50Cd30Ff7f0fbBD9d0FDe1F60DE8c52D6F390c5C` |
| LFT Token (utility) | `0x62B9559F193d111aF92d9a5604d79024BFB1C847` |
| LaunchFutureExchange | `0x9680B43F695d5245062e59CCA92ad92DE5aed56e` |
| LFTDeployer | `0x3f81E785628D452A8Aae1536D15A3586B490F0c5` |
| LFTFactory | `0xcd86Ca358283f06581365635372E5bF0D30271D3` |

RPC: `https://rpc.evozscan.com` · Explorer: `https://evozscan.com` · Chain ID: `805`

## Yang belum termasuk / ide pengembangan lanjutan

- Fitur **beli LFT dengan native coin** (`purchaseWithNative` di
  `LaunchFutureExchange`) belum ada UI-nya — bisa ditambah kalau perlu.
- Belum ada indexer/backend, jadi "Token Saya" murni membaca on-chain lewat
  `getCreatorTokens` setiap kali dibuka (sedikit lebih lambat tapi 100%
  trustless, tidak butuh server).
- Untuk trading/DEX listing pasca-deploy, itu di luar cakupan generator ini.
