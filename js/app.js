/* global ethers, CHAINS, DEFAULT_CHAIN_ID, getEnabledChains, getChain */

let provider, signer, account, currentChainId;
let factoryAbi, exchangeAbi, erc20Abi;
let quotedFee = null; // { nativeFee: BigInt, lftFee: BigInt }

const $ = (id) => document.getElementById(id);

// -------------------------------------------------------------------------
// Toast
// -------------------------------------------------------------------------
function toast(msg, kind) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = "toast"), 4200);
}

// -------------------------------------------------------------------------
// Init
// -------------------------------------------------------------------------
async function init() {
  [factoryAbi, exchangeAbi, erc20Abi] = await Promise.all([
    fetch("js/abi/LFTFactory.json").then((r) => r.json()),
    fetch("js/abi/LaunchFutureExchange.json").then((r) => r.json()),
    fetch("js/abi/ERC20Min.json").then((r) => r.json()),
  ]);

  renderChainGrid();
  fillContractFields();
  wireTabs();
  wireSwitches();
  wireButtons();

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
    // silent reconnect if already authorized
    try {
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if (accs && accs[0]) await connectWallet(true);
    } catch (e) {}
  }

  refreshPublicStats();
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $("panel-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "mytokens") loadMyTokens();
    });
  });
}

function wireSwitches() {
  // purely visual toggles, no extra JS needed beyond CSS — placeholder for future UX (disable fields when off)
}

function wireButtons() {
  $("walletBtn").addEventListener("click", () => connectWallet(false));
  $("btnQuote").addEventListener("click", quoteDeployFee);
  $("btnDeploy").addEventListener("click", deployToken);
  $("btnRefreshTokens").addEventListener("click", loadMyTokens);
}

// -------------------------------------------------------------------------
// Wallet connection
// -------------------------------------------------------------------------
async function connectWallet(silent) {
  if (!window.ethereum) {
    toast("Buka lewat browser wallet (MetaMask / Trust Wallet) di HP kamu.", "err");
    return;
  }
  try {
    const accs = await window.ethereum.request({
      method: silent ? "eth_accounts" : "eth_requestAccounts",
    });
    if (!accs || !accs[0]) return;
    account = accs[0];
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const net = await provider.getNetwork();
    currentChainId = Number(net.chainId);

    $("walletBtn").classList.add("connected");
    $("walletBtnText").textContent = account.slice(0, 6) + "…" + account.slice(-4);

    await ensureSupportedChain();
    refreshPublicStats();
  } catch (err) {
    if (!silent) toast(err.shortMessage || err.message || "Gagal menghubungkan wallet", "err");
  }
}

async function ensureSupportedChain() {
  const chain = getChain(currentChainId);
  if (chain && chain.enabled) return true;

  toast(`Jaringan belum didukung. Beralih ke ${getChain(DEFAULT_CHAIN_ID).name}…`);
  return switchToChain(DEFAULT_CHAIN_ID);
}

async function switchToChain(chainId) {
  const chain = getChain(chainId);
  if (!chain) return false;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainIdHex }],
    });
    return true;
  } catch (switchErr) {
    if (switchErr.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chain.chainIdHex,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls,
              blockExplorerUrls: chain.blockExplorerUrls,
            },
          ],
        });
        return true;
      } catch (addErr) {
        toast("Gagal menambah jaringan: " + (addErr.message || ""), "err");
        return false;
      }
    }
    toast("Gagal beralih jaringan: " + (switchErr.message || ""), "err");
    return false;
  }
}

// -------------------------------------------------------------------------
// Read-only provider (works even without wallet connected)
// -------------------------------------------------------------------------
function readProvider(chainId) {
  const chain = getChain(chainId || DEFAULT_CHAIN_ID);
  return new ethers.JsonRpcProvider(chain.rpcUrls[0], undefined, { staticNetwork: true });
}

function factoryReadContract(chainId) {
  const chain = getChain(chainId || DEFAULT_CHAIN_ID);
  return new ethers.Contract(chain.contracts.factory, factoryAbi, readProvider(chainId));
}

function factoryWriteContract() {
  const chain = getChain(currentChainId);
  return new ethers.Contract(chain.contracts.factory, factoryAbi, signer);
}

async function refreshPublicStats() {
  try {
    const chainId = currentChainId || DEFAULT_CHAIN_ID;
    const chain = getChain(chainId);
    $("stripChain").textContent = chain ? `${chain.name} (${chainId})` : `chain ${chainId} (belum didukung)`;
    $("stripChain").className = "mono " + (chain && chain.enabled ? "ok" : "warn");

    const factory = factoryReadContract(chainId);
    const [fee] = await factory.getDeployFee("NATIVE");
    $("stripFee").textContent = ethers.formatEther(fee) + " " + chain.nativeCurrency.symbol;

    const stats = await factory.getStatistics();
    $("stripTotal").textContent = stats.totalTokens.toString();
  } catch (e) {
    $("stripFee").textContent = "n/a";
    $("stripTotal").textContent = "n/a";
  }
}

// -------------------------------------------------------------------------
// Network tab rendering
// -------------------------------------------------------------------------
function renderChainGrid() {
  const grid = $("chainGrid");
  grid.innerHTML = "";
  Object.entries(CHAINS).forEach(([id, c]) => {
    const div = document.createElement("div");
    div.className = "chain-chip" + (c.enabled ? "" : " disabled");
    div.innerHTML = `<span class="cdot"></span><div><div class="cname">${c.shortName}</div><div class="csoon">${
      c.enabled ? "chain " + id + " · aktif" : "segera hadir"
    }</div></div>`;
    if (c.enabled) {
      div.style.cursor = "pointer";
      div.addEventListener("click", () => switchToChain(Number(id)));
    }
    grid.appendChild(div);
  });
}

function fillContractFields() {
  const c = getChain(DEFAULT_CHAIN_ID).contracts;
  $("cFactory").value = c.factory;
  $("cDeployer").value = c.deployer;
  $("cExchange").value = c.exchange;
  $("cLft").value = c.lftToken;
  $("cTreasury").value = c.treasury;
}

// -------------------------------------------------------------------------
// Build TokenConfig / MetadataConfig from form
// -------------------------------------------------------------------------
function val(id) { return $(id).value.trim(); }
function num(id) { const v = val(id); return v === "" ? 0 : Number(v); }
function chk(id) { return $(id).checked; }
function addrOr(id, fallback) { const v = val(id); return v === "" ? fallback : v; }

function sumShares() {
  return num("shBurn") + num("shMarketing") + num("shDevelopment") + num("shTreasury") +
         num("shLiquidity") + num("shBuyback") + num("shCharity");
}

function buildConfig() {
  if (!account) throw new Error("Hubungkan wallet dulu.");
  const name = val("tName");
  const symbol = val("tSymbol").toUpperCase();
  if (!name || !symbol) throw new Error("Nama dan simbol token wajib diisi.");

  const owner = addrOr("tOwner", account);
  const initialSupply = ethers.parseUnits(val("sInitial") || "0", 18);
  const maxSupply = ethers.parseUnits(val("sMax") || "0", 18);

  // Tax shares must always total exactly 100 per contract rule.
  let shares = {
    burn: num("shBurn"), marketing: num("shMarketing"), development: num("shDevelopment"),
    treasury: num("shTreasury"), liquidity: num("shLiquidity"), buyback: num("shBuyback"), charity: num("shCharity"),
  };
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  if (total !== 100) {
    if (total === 0) {
      shares.treasury = 100; // sensible default: everything to treasury wallet
    } else {
      throw new Error(`Total distribusi pajak harus tepat 100%. Sekarang: ${total}%.`);
    }
  }

  const config = {
    name, symbol, owner,
    supply: {
      initialSupply, maxSupply,
      mintable: chk("sMintable"), burnable: chk("sBurnable"),
    },
    security: {
      antiBot: chk("secAntiBot"), blacklist: chk("secBlacklist"), whitelist: chk("secWhitelist"),
      tradingDelay: chk("secTradingDelay"),
      maxWalletEnabled: chk("secMaxWalletEnabled"), maxTxEnabled: chk("secMaxTxEnabled"),
      maxWalletPercent: Math.round(num("secMaxWalletPercent")), maxTxPercent: Math.round(num("secMaxTxPercent")),
      antiBotBlocks: Math.round(num("secAntiBotBlocks")), tradingDelaySeconds: Math.round(num("secTradingDelaySeconds")),
    },
    taxes: {
      buyTaxEnabled: chk("txBuyEnabled"), sellTaxEnabled: chk("txSellEnabled"), transferTaxEnabled: chk("txTransferEnabled"),
      buyTax: Math.round(num("txBuy")), sellTax: Math.round(num("txSell")), transferTax: Math.round(num("txTransfer")),
      burnShare: shares.burn, marketingShare: shares.marketing, developmentShare: shares.development,
      treasuryShare: shares.treasury, liquidityShare: shares.liquidity, buybackShare: shares.buyback, charityShare: shares.charity,
      marketingWallet: addrOr("wMarketing", account),
      developmentWallet: addrOr("wDevelopment", account),
      treasuryWallet: addrOr("wTreasury", account),
      liquidityWallet: addrOr("wLiquidity", account),
      buybackWallet: addrOr("wBuyback", account),
      charityWallet: addrOr("wCharity", account),
    },
  };

  const metadata = {
    website: val("mWebsite"), telegram: val("mTelegram"), twitter: val("mTwitter"), logoURI: val("mLogo"),
  };

  return { config, metadata };
}

// -------------------------------------------------------------------------
// Quote + Deploy
// -------------------------------------------------------------------------
function log(msg, cls) {
  const box = $("deployLog");
  box.style.display = "block";
  const line = document.createElement("div");
  line.className = "l " + (cls || "");
  line.textContent = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

async function quoteDeployFee() {
  try {
    if (!signer) { await connectWallet(false); if (!signer) return; }
    const factory = factoryReadContract(currentChainId);
    const [nativeFee] = await factory.getDeployFee("NATIVE");
    const [, utilityAmount] = await factory.quoteNativeFee("NATIVE");
    quotedFee = { nativeFee, lftFee: utilityAmount };
    const chain = getChain(currentChainId);
    $("feeNative").textContent = ethers.formatEther(nativeFee) + " " + chain.nativeCurrency.symbol;
    $("feeLFT").textContent = "≈ " + ethers.formatEther(utilityAmount) + " LFT";
    $("btnDeploy").disabled = false;
    toast("Biaya deploy berhasil dihitung.", "ok");
  } catch (e) {
    toast(e.shortMessage || e.message || "Gagal menghitung biaya", "err");
  }
}

async function deployToken() {
  $("deployLog").innerHTML = "";
  try {
    if (!signer) throw new Error("Hubungkan wallet dulu.");
    if (!quotedFee) throw new Error("Hitung biaya deploy dulu.");

    const { config, metadata } = buildConfig();
    log("Menyiapkan konfigurasi token…", "pending");

    const factory = factoryWriteContract();
    log(`Mengirim transaksi deployWithNative (bayar ${ethers.formatEther(quotedFee.nativeFee)} native)…`, "pending");

    const tx = await factory.deployWithNative(config, metadata, { value: quotedFee.nativeFee });
    log("Tx terkirim: " + tx.hash, "pending");

    const receipt = await tx.wait();
    log("Terkonfirmasi di block " + receipt.blockNumber, "ok");

    const chain = getChain(currentChainId);
    log("Lihat transaksi: " + chain.blockExplorerUrls[0] + "/tx/" + tx.hash, "ok");

    toast("Token berhasil dideploy! 🎉", "ok");
    $("btnDeploy").disabled = true;
    quotedFee = null;
  } catch (e) {
    log("Gagal: " + (e.shortMessage || e.reason || e.message || "unknown error"), "err");
    toast("Deploy gagal. Cek log di bawah.", "err");
  }
}

// -------------------------------------------------------------------------
// My Tokens
// -------------------------------------------------------------------------
async function loadMyTokens() {
  const list = $("myTokensList");
  if (!account) {
    list.innerHTML = `<div class="empty">Hubungkan wallet untuk melihat token yang sudah Anda buat.</div>`;
    return;
  }
  list.innerHTML = `<div class="empty">Memuat…</div>`;
  try {
    const chain = getChain(currentChainId || DEFAULT_CHAIN_ID);
    const factory = factoryReadContract(currentChainId || DEFAULT_CHAIN_ID);
    const addrs = await factory.getCreatorTokens(account);

    if (!addrs.length) {
      list.innerHTML = `<div class="empty">Belum ada token. Buat token pertama Anda di tab "Buat Token".</div>`;
      return;
    }

    const rp = readProvider(currentChainId || DEFAULT_CHAIN_ID);
    list.innerHTML = "";
    for (const addr of addrs) {
      let name = "?", symbol = "?", supply = "?";
      try {
        const t = new ethers.Contract(addr, erc20Abi, rp);
        [name, symbol] = await Promise.all([t.name(), t.symbol()]);
        const [ts, dec] = await Promise.all([t.totalSupply(), t.decimals()]);
        supply = Number(ethers.formatUnits(ts, dec)).toLocaleString("id-ID");
      } catch (e) {}

      const item = document.createElement("div");
      item.className = "token-item";
      item.innerHTML = `
        <div class="ticker">${symbol.slice(0, 3)}</div>
        <div class="meta">
          <div class="n">${name} <span class="mono" style="color:var(--text-dim);font-size:11.5px;">${symbol}</span></div>
          <div class="a">${addr}</div>
        </div>
        <a class="go" href="${chain.blockExplorerUrls[0]}/token/${addr}" target="_blank" rel="noopener">Explorer ↗</a>
      `;
      list.appendChild(item);
    }
  } catch (e) {
    list.innerHTML = `<div class="empty">Gagal memuat token: ${e.message || e}</div>`;
  }
}

init();
