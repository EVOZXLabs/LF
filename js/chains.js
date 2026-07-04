/**
 * chains.js
 * -------------------------------------------------------------------------
 * Registry pusat semua jaringan yang didukung LaunchFuture Token Generator.
 *
 * CARA MENAMBAH JARINGAN BARU (BSC, ETH, Polygon, dll) DI MASA DEPAN:
 *   1. Duplikat salah satu blok di bawah.
 *   2. Isi chainId, rpcUrls, blockExplorerUrls sesuai jaringan tsb.
 *   3. Isi contracts.factory & contracts.exchange dengan address hasil
 *      deploy ulang LFTFactory + LaunchFutureExchange di jaringan itu.
 *   4. Ubah "enabled: false" menjadi "enabled: true".
 *   Tidak perlu mengubah file lain — app.js membaca daftar ini secara dinamis.
 * -------------------------------------------------------------------------
 */

const CHAINS = {
  // ============================ EVOZ MAINNET — LIVE ============================
  805: {
    enabled: true,
    chainIdHex: "0x325", // 805 in hex
    name: "EVOZ Mainnet",
    shortName: "EVOZ",
    nativeCurrency: { name: "EVOZ", symbol: "EVOZ", decimals: 18 },
    rpcUrls: ["https://rpc.evozscan.com"],
    blockExplorerUrls: ["https://evozscan.com"],
    contracts: {
      treasury:  "0x50Cd30Ff7f0fbBD9d0FDe1F60DE8c52D6F390c5C",
      lftToken:  "0x62B9559F193d111aF92d9a5604d79024BFB1C847",
      exchange:  "0x9680B43F695d5245062e59CCA92ad92DE5aed56e",
      deployer:  "0x3f81E785628D452A8Aae1536D15A3586B490F0c5",
      factory:   "0xcd86Ca358283f06581365635372E5bF0D30271D3"
    }
  },

  // ============================ BSC MAINNET — BELUM DEPLOY ============================
  56: {
    enabled: false,
    chainIdHex: "0x38",
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
    contracts: { treasury: "", lftToken: "", exchange: "", deployer: "", factory: "" }
  },

  // ============================ ETHEREUM MAINNET — BELUM DEPLOY ============================
  1: {
    enabled: false,
    chainIdHex: "0x1",
    name: "Ethereum Mainnet",
    shortName: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://cloudflare-eth.com"],
    blockExplorerUrls: ["https://etherscan.io"],
    contracts: { treasury: "", lftToken: "", exchange: "", deployer: "", factory: "" }
  },

  // ============================ POLYGON — BELUM DEPLOY ============================
  137: {
    enabled: false,
    chainIdHex: "0x89",
    name: "Polygon",
    shortName: "POL",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
    contracts: { treasury: "", lftToken: "", exchange: "", deployer: "", factory: "" }
  }
};

const DEFAULT_CHAIN_ID = 805;

function getEnabledChains() {
  return Object.entries(CHAINS)
    .filter(([, c]) => c.enabled)
    .map(([id, c]) => ({ id: Number(id), ...c }));
}

function getChain(chainId) {
  return CHAINS[Number(chainId)] || null;
}
