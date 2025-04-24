// Solana Mainnet Distributor Bot
// Bot untuk mengirim SOL dari satu wallet ke banyak wallet di Solana mainnet
// Menggunakan data wallet dari file JSON yang dibuat oleh Multi-Wallet Generator
// Compatible dengan Node.js v20+

// Untuk menjalankan kode ini, install package berikut:
// npm install @solana/web3.js@latest bip39@latest ed25519-hd-key@latest bs58@latest prompt-sync@latest dotenv@latest node-fetch@2

// Fix untuk Node.js v20+ yang mungkin memiliki masalah fetch
global.fetch = require('node-fetch');

const { 
  Keypair, 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction, 
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} = require('@solana/web3.js');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const bs58 = require('bs58');
const fs = require('fs');
const prompt = require('prompt-sync')({ sigint: true });
// Tambahkan dotenv untuk mengakses file .env
require('dotenv').config();

// Konstanta - Tambahkan multiple RPC endpoints sebagai fallback
const RPC_ENDPOINTS = {
  MAINNET: [
    'https://mainnet.helius-rpc.com/?api-key=8dc65132-e52c-42bb-8bda-b9d339343b90',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana'
  ],
  DEVNET: [
    'https://api.devnet.solana.com',
    'https://devnet.genesysgo.net'
  ]
};

// Default URL yang akan digunakan
let MAINNET_URL = RPC_ENDPOINTS.MAINNET[0];
let DEVNET_URL = RPC_ENDPOINTS.DEVNET[0];
const SOLANA_EXPLORER_URL = 'https://explorer.solana.com/tx/';

// Pengaturan retry untuk koneksi
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Fungsi untuk menguji koneksi dan memilih endpoint yang berfungsi
async function testAndSelectEndpoint(networkType = 'MAINNET') {
  const endpoints = networkType === 'MAINNET' ? RPC_ENDPOINTS.MAINNET : RPC_ENDPOINTS.DEVNET;
  
  console.log(`\nMenguji koneksi ke ${networkType}...`);
  
  for (const endpoint of endpoints) {
    try {
      const connection = new Connection(endpoint, 'confirmed');
      // Coba dapatkan slot terkini sebagai tes koneksi sederhana
      const slot = await connection.getSlot();
      console.log(`✅ Berhasil terhubung ke ${endpoint} (slot: ${slot})`);
      
      // Kembalikan endpoint yang berhasil
      if (networkType === 'MAINNET') {
        MAINNET_URL = endpoint;
      } else {
        DEVNET_URL = endpoint;
      }
      return endpoint;
    } catch (error) {
      console.log(`❌ Gagal terhubung ke ${endpoint}: ${error.message}`);
    }
  }
  
  throw new Error(`Gagal terhubung ke semua endpoint ${networkType}. Periksa koneksi internet Anda.`);
}

// Fungsi untuk membuat koneksi dengan retry logic
async function createConnection(url, retries = MAX_RETRIES) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const connection = new Connection(url, 'confirmed');
      // Lakukan tes kecil untuk memvalidasi koneksi
      await connection.getRecentBlockhash();
      return connection;
    } catch (error) {
      console.log(`Percobaan ${i+1}/${retries} gagal: ${error.message}`);
      lastError = error;
      
      if (i < retries - 1) {
        console.log(`Menunggu ${RETRY_DELAY/1000} detik sebelum mencoba lagi...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  throw new Error(`Gagal membuat koneksi setelah ${retries} percobaan: ${lastError.message}`);
}

// Fungsi untuk membuat keypair dari private key
function getKeypairFromPrivateKey(privateKeyString) {
  try {
    // Decode private key dari format base58
    const privateKey = bs58.decode(privateKeyString);
    return Keypair.fromSecretKey(privateKey);
  } catch (error) {
    console.error(`Error membuat keypair dari private key: ${error.message}`);
    return null;
  }
}

// Fungsi untuk memeriksa file .env
function checkEnvFile() {
  // Cek apakah .env file ada
  if (!fs.existsSync('.env')) {
    console.log(`\nFile .env tidak ditemukan.`);
    console.log(`Membuat file .env template...`);
    
    const envTemplate = `# Solana Mainnet Distributor Configuration
# Private key untuk wallet pengirim (base58 format)
SENDER_PRIVATE_KEY=

# ATAU gunakan seed phrase dan path (jika SENDER_PRIVATE_KEY tidak ada)
SEED_PHRASE=
DERIVATION_PATH=

# Konfigurasi jaringan
NETWORK_URL=https://api.mainnet-beta.solana.com
# NETWORK_URL=https://api.devnet.solana.com
`;
    
    fs.writeFileSync('.env', envTemplate);
    console.log(`File .env template telah dibuat. Silakan isi dengan private key atau seed phrase Anda.`);
    return false;
  }
  
  // Cek isi file .env
  if (!process.env.SENDER_PRIVATE_KEY && !process.env.SEED_PHRASE) {
    console.log(`\nWarning: Private key atau seed phrase tidak ditemukan di file .env.`);
    console.log(`Silakan tambahkan SENDER_PRIVATE_KEY atau SEED_PHRASE di file .env.`);
    return false;
  }
  
  return true;
}

// Fungsi untuk derive keypair dari mnemonic dan path
function getKeypairFromMnemonic(mnemonic, derivationPath) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedKey = derivePath(derivationPath, seed.toString('hex'));
  const keypair = Keypair.fromSeed(derivedKey.key);
  return keypair;
}

// Fungsi untuk membaca wallet dari file JSON
function loadWalletsFromJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File ${filePath} tidak ditemukan!`);
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const walletData = JSON.parse(data);
    
    console.log(`Berhasil membaca data wallet dari ${filePath}`);
    console.log(`Jumlah wallet: ${walletData.wallets.length}`);
    
    return walletData;
  } catch (error) {
    console.error(`Error membaca file wallet: ${error.message}`);
    return null;
  }
}

// Fungsi untuk menampilkan saldo wallet dengan retry
async function getWalletBalance(publicKey, networkUrl = MAINNET_URL) {
  try {
    // Ciptakan koneksi dengan retry logic
    const connection = await createConnection(networkUrl);
    
    try {
      const balance = await connection.getBalance(new PublicKey(publicKey));
      return balance / LAMPORTS_PER_SOL; // Konversi dari lamports ke SOL
    } catch (error) {
      console.error(`Error mendapatkan saldo: ${error}`);
      return 0;
    }
  } catch (error) {
    console.error(`Gagal membuat koneksi ke jaringan: ${error.message}`);
    return 0;
  }
}

// Fungsi untuk memproses penerima
async function processRecipients(senderKeypair, senderPublicKey) {
  // Tentukan network URL dari .env atau gunakan default yang sudah dites
  let networkUrl = process.env.NETWORK_URL || MAINNET_URL;
  const isMainnet = networkUrl.includes('mainnet');
  
  // Tes koneksi ke network yang dipilih
  try {
    networkUrl = await testAndSelectEndpoint(isMainnet ? 'MAINNET' : 'DEVNET');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log("Tidak dapat melanjutkan tanpa koneksi jaringan yang stabil.");
    return;
  }
  
  console.log(`\n===== WALLET PENGIRIM =====`);
  console.log(`Public Key: ${senderPublicKey}`);
  console.log(`Network: ${networkUrl.includes('mainnet') ? 'MAINNET' : 'DEVNET'}`);
  
  // Cek saldo
  const senderBalance = await getWalletBalance(senderPublicKey, networkUrl);
  console.log(`Saldo: ${senderBalance} SOL`);
  
  if (senderBalance <= 0.01) {
    console.log("Wallet pengirim tidak memiliki cukup SOL untuk mengirim transaksi!");
    return;
  }
  
  // Pilih wallet penerima
  console.log(`\n===== PILIH WALLET PENERIMA =====`);
  console.log("1. Alamat dari file JSON");
  console.log("2. Alamat dari file CSV");
  console.log("3. Masukkan alamat secara manual");
  
  const recipientMethod = prompt("Pilih metode (1-3): ");
  let recipientAddresses = [];
  
  if (recipientMethod === "1") {
    // Dari file JSON
    const walletFilePath = prompt("Masukkan lokasi file JSON wallet (default: solana_wallets.json): ") || "solana_wallets.json";
    
    // Load wallet data
    const walletData = loadWalletsFromJson(walletFilePath);
    
    if (!walletData) {
      console.error("Tidak dapat melanjutkan tanpa data wallet.");
      return;
    }
    
    console.log(`\n===== PILIH WALLET PENERIMA =====`);
    console.log("1. Semua wallet kecuali pengirim");
    console.log("2. Range wallet tertentu");
    console.log("3. Wallet tertentu (manual)");
    
    const recipientOption = prompt("Pilih opsi (1-3): ");
    
    switch (recipientOption) {
      case "1":
        // Semua wallet kecuali pengirim
        recipientAddresses = walletData.wallets
          .filter(wallet => wallet.publicKey !== senderPublicKey)
          .map(wallet => wallet.publicKey);
        console.log(`${recipientAddresses.length} wallet dipilih sebagai penerima.`);
        break;
        
      case "2":
        // Range wallet tertentu
        const rangeInput = prompt("Masukkan range (misal: 1-10): ");
        const [start, end] = rangeInput.split('-').map(x => parseInt(x) - 1);
        
        if (isNaN(start) || isNaN(end) || start < 0 || end >= walletData.wallets.length || start > end) {
          console.log("Range tidak valid!");
          return;
        }
        
        for (let i = start; i <= end; i++) {
          // Jangan masukkan wallet pengirim ke daftar penerima
          if (walletData.wallets[i].publicKey !== senderPublicKey) {
            recipientAddresses.push(walletData.wallets[i].publicKey);
          }
        }
        
        console.log(`${recipientAddresses.length} wallet dalam range dipilih sebagai penerima.`);
        break;
        
      case "3":
        // Wallet tertentu (manual)
        const manualInput = prompt("Masukkan nomor wallet dipisahkan koma (misal: 1,3,5,7): ");
        const manualIndices = manualInput.split(',')
          .map(x => parseInt(x.trim()) - 1)
          .filter(x => !isNaN(x) && x >= 0 && x < walletData.wallets.length);
          
        for (const idx of manualIndices) {
          // Jangan masukkan wallet pengirim ke daftar penerima
          if (walletData.wallets[idx].publicKey !== senderPublicKey) {
            recipientAddresses.push(walletData.wallets[idx].publicKey);
          }
        }
        
        console.log(`${recipientAddresses.length} wallet dipilih secara manual sebagai penerima.`);
        break;
        
      default:
        console.log("Opsi tidak valid!");
        return;
    }
    
  } else if (recipientMethod === "2") {
    // Alamat dari file CSV
    const csvFilePath = prompt("Masukkan lokasi file CSV: ");
    
    try {
      const csvContent = fs.readFileSync(csvFilePath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      // Verifikasi format dan validasi alamat
      recipientAddresses = lines
        .map(line => line.trim().split(',')[0].trim()) // Ambil kolom pertama
        .filter(address => {
          try {
            // Validasi alamat Solana
            new PublicKey(address);
            // Jangan masukkan wallet pengirim ke daftar penerima
            return address !== senderPublicKey;
          } catch (e) {
            console.log(`Alamat tidak valid: ${address}`);
            return false;
          }
        });
        
      console.log(`${recipientAddresses.length} alamat valid ditemukan di file CSV.`);
    } catch (error) {
      console.error(`Error membaca file CSV: ${error.message}`);
      return;
    }
    
  } else if (recipientMethod === "3") {
    // Masukkan alamat secara manual
    console.log("\nMasukkan alamat penerima (satu per baris). Ketik 'selesai' untuk berhenti:");
    
    let inputAddress;
    while (true) {
      inputAddress = prompt("> ");
      
      if (inputAddress.toLowerCase() === 'selesai') {
        break;
      }
      
      try {
        // Validasi alamat
        new PublicKey(inputAddress);
        
        // Jangan tambahkan jika sama dengan pengirim
        if (inputAddress !== senderPublicKey) {
          recipientAddresses.push(inputAddress);
          console.log(`Alamat ditambahkan (Total: ${recipientAddresses.length})`);
        } else {
          console.log("Alamat pengirim tidak bisa menjadi penerima!");
        }
      } catch (e) {
        console.log("Alamat tidak valid, coba lagi!");
      }
    }
    
  } else {
    console.log("Pilihan tidak valid!");
    return;
  }
  
  if (recipientAddresses.length === 0) {
    console.log("Tidak ada wallet penerima yang dipilih!");
    return;
  }
  
  // Jumlah SOL per wallet
  const amountPerRecipient = parseFloat(prompt("Jumlah SOL yang akan dikirim ke setiap penerima: "));
  
  if (isNaN(amountPerRecipient) || amountPerRecipient <= 0) {
    console.log("Jumlah SOL tidak valid!");
    return;
  }
  
  // Opsi priority fee
  const usePriorityFee = prompt("Gunakan priority fee untuk transaksi lebih cepat? (y/n): ").toLowerCase() === 'y';
  let priorityFee = 0;
  
  if (usePriorityFee) {
    priorityFee = parseFloat(prompt("Masukkan jumlah priority fee (dalam SOL, disarankan 0.0001-0.001): "));
    
    if (isNaN(priorityFee) || priorityFee < 0) {
      console.log("Priority fee tidak valid!");
      return;
    }
  }
  
  // Pilih network
  const networkChoice = prompt(`Network: [1] Mainnet | [2] Devnet (default: ${networkUrl.includes('mainnet') ? "Mainnet" : "Devnet"}): `);
  
  if (networkChoice === "1") {
    networkUrl = MAINNET_URL;
  } else if (networkChoice === "2") {
    networkUrl = DEVNET_URL;
  }
  
  const isMainnetSelected = networkUrl.includes('mainnet');
  
  // Total yang akan dikirim
  const totalAmount = amountPerRecipient * recipientAddresses.length;
  const estimatedFee = 0.01; // Estimasi kasar biaya transaksi total
  
  console.log(`\n===== KONFIRMASI DISTRIBUSI =====`);
  console.log(`Network: ${isMainnetSelected ? "MAINNET" : "DEVNET"}`);
  console.log(`RPC Endpoint: ${networkUrl}`);
  console.log(`Pengirim: ${senderPublicKey}`);
  console.log(`Jumlah penerima: ${recipientAddresses.length}`);
  console.log(`Jumlah SOL per penerima: ${amountPerRecipient}`);
  console.log(`Total SOL yang akan dikirim: ${totalAmount}`);
  console.log(`Estimasi biaya transaksi: ~${estimatedFee} SOL`);
  console.log(`Priority fee: ${priorityFee} SOL per transaksi`);
  console.log(`\nSaldo yang dibutuhkan (minimal): ${totalAmount + estimatedFee} SOL`);
  console.log(`Saldo wallet pengirim: ${senderBalance} SOL`);
  
  if (senderBalance < (totalAmount + estimatedFee)) {
    console.log("\n⚠️ PERINGATAN: Saldo mungkin tidak mencukupi untuk semua transaksi dan biaya!");
  }
  
  if (isMainnetSelected) {
    console.log(`\n⚠️ PERINGATAN: Ini adalah transaksi MAINNET dengan SOL ASLI! ⚠️`);
    const finalConfirm = prompt("Ketik 'SAYA SETUJU' untuk mengkonfirmasi pengiriman: ");
    
    if (finalConfirm !== 'SAYA SETUJU') {
      console.log("Distribusi dibatalkan.");
      return;
    }
  } else {
    const finalConfirm = prompt("Konfirmasi pengiriman? (y/n): ");
    
    if (finalConfirm.toLowerCase() !== 'y') {
      console.log("Distribusi dibatalkan.");
      return;
    }
  }
  
  // Kirim SOL ke semua penerima
  await distributeSOL(senderKeypair, recipientAddresses, amountPerRecipient, priorityFee, networkUrl);
}

// Fungsi untuk distributeSOL
async function distributeSOL(senderKeypair, recipientAddresses, amountPerRecipient, priorityFee = 0, networkUrl = MAINNET_URL) {
  try {
    // Ciptakan koneksi dengan retry logic
    const connection = await createConnection(networkUrl);
    const isMainnet = networkUrl.includes('mainnet');
    
    // Menambahkan semua transaksi ke dalam batch
    const batchResults = [];
    
    console.log(`\n===== DISTRIBUSI SOL DI ${isMainnet ? "MAINNET" : "DEVNET"} =====`);
    console.log(`Pengirim: ${senderKeypair.publicKey.toString()}`);
    console.log(`Jumlah penerima: ${recipientAddresses.length}`);
    console.log(`Jumlah SOL per penerima: ${amountPerRecipient}`);
    console.log(`Total SOL yang akan dikirim: ${amountPerRecipient * recipientAddresses.length}`);
    
    // Cek saldo pengirim
    let senderBalance;
    try {
      senderBalance = await connection.getBalance(senderKeypair.publicKey);
    } catch (error) {
      console.error(`Error mendapatkan saldo: ${error.message}`);
      console.log("Mencoba koneksi alternatif...");
      // Coba endpoint alternatif
      const alternativeEndpoint = isMainnet ? 
                                RPC_ENDPOINTS.MAINNET.find(ep => ep !== networkUrl) : 
                                RPC_ENDPOINTS.DEVNET.find(ep => ep !== networkUrl);
      if (alternativeEndpoint) {
        const altConnection = await createConnection(alternativeEndpoint);
        senderBalance = await altConnection.getBalance(senderKeypair.publicKey);
      } else {
        throw new Error("Tidak dapat mendapatkan saldo wallet. Semua koneksi gagal.");
      }
    }
    
    const senderBalanceInSOL = senderBalance / LAMPORTS_PER_SOL;
    
    console.log(`\nSaldo pengirim: ${senderBalanceInSOL} SOL`);
    
    // Hitung total yang dibutuhkan (termasuk perkiraan biaya transaksi)
    const totalNeeded = (amountPerRecipient * recipientAddresses.length) + 0.01; // Tambah 0.01 SOL untuk biaya transaksi
    
    if (senderBalanceInSOL < totalNeeded) {
      console.error(`Error: Saldo tidak mencukupi! Dibutuhkan ~${totalNeeded} SOL`);
      return { success: 0, fail: recipientAddresses.length };
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // Membuat progress bar sederhana
    const progressBar = (current, total) => {
      const percent = Math.floor((current / total) * 100);
      const bar = '#'.repeat(Math.floor(percent / 2)) + '-'.repeat(50 - Math.floor(percent / 2));
      return `[${bar}] ${percent}% (${current}/${total})`;
    };
    
    console.log(`\nMemulai proses pengiriman...`);
    
    for (let i = 0; i < recipientAddresses.length; i++) {
      const toAddress = recipientAddresses[i];
      
      try {
        // Buat transaksi baru
        const transaction = new Transaction();
        
        // Dapatkan blockhash untuk setiap transaksi
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderKeypair.publicKey;
        
        // Tambahkan instruksi priority fee jika diperlukan
        if (priorityFee > 0) {
          transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: priorityFee * 1_000_000 // konversi ke microlamports
            })
          );
        }
        
        // Tambahkan instruksi transfer
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports: Math.floor(amountPerRecipient * LAMPORTS_PER_SOL),
          })
        );
        
        // Kirim transaksi
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [senderKeypair],
          { commitment: 'confirmed' }
        );
        
        console.log(`✅ Transfer #${i+1} berhasil: ${toAddress.slice(0, 10)}...${toAddress.slice(-6)}`);
        console.log(`   Signature: ${signature}`);
        
        // Tampilkan progress
        console.log(progressBar(i + 1, recipientAddresses.length));
        
        batchResults.push({
          recipient: toAddress,
          amount: amountPerRecipient,
          status: 'success',
          signature: signature
        });
        
        successCount++;
        
        // Jeda sebentar antara transaksi untuk mengurangi rate limiting
        if (i < recipientAddresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Transfer #${i+1} gagal ke ${toAddress.slice(0, 10)}...${toAddress.slice(-6)}: ${error.message}`);
        batchResults.push({
          recipient: toAddress,
          amount: amountPerRecipient,
          status: 'failed',
          error: error.message
        });
        
        failCount++;
      }
    }
    
    // Simpan hasil ke file log
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const logFilename = `distribution_log_${timestamp}.json`;
    
    fs.writeFileSync(logFilename, JSON.stringify({
      sender: senderKeypair.publicKey.toString(),
      network: isMainnet ? "mainnet" : "devnet",
      totalSent: successCount * amountPerRecipient,
      timestamp: new Date().toISOString(),
      results: batchResults
    }, null, 2));
    
    console.log(`\n===== HASIL DISTRIBUSI =====`);
    console.log(`✅ Berhasil: ${successCount} transaksi (${successCount * amountPerRecipient} SOL)`);
    console.log(`❌ Gagal: ${failCount} transaksi`);
    console.log(`Log disimpan di: ${logFilename}`);
    
    return { success: successCount, fail: failCount };
  } catch (error) {
    console.error(`Fatal error dalam proses distribusi: ${error.message}`);
    return { success: 0, fail: recipientAddresses.length };
  }
}

// Fungsi utama
async function main() {
  console.log(`\n===== SOLANA MAINNET DISTRIBUTOR BOT =====`);
  console.log(`Bot untuk mengirim SOL dari satu wallet ke banyak wallet di Solana mainnet`);
  console.log(`⚠️  PERHATIAN: Transaksi di mainnet menggunakan SOL asli! ⚠️`);
  console.log(`=`.repeat(50));
  
  // Periksa koneksi internet terlebih dahulu
  try {
    console.log("Menguji koneksi internet...");
    
    // Tes koneksi mainnet dan devnet
    // Ini juga akan memilih endpoint terbaik untuk digunakan
    MAINNET_URL = await testAndSelectEndpoint('MAINNET');
    DEVNET_URL = await testAndSelectEndpoint('DEVNET');
    
  } catch (error) {
    console.error(`Error koneksi: ${error.message}`);
    console.log("Tidak dapat melanjutkan tanpa koneksi internet. Silakan periksa koneksi Anda.");
    return;
  }
  
  // Cek apakah file .env tersedia dan valid
  checkEnvFile();
  
  // Pilih metode untuk wallet pengirim
  console.log(`\n===== PILIH METODE WALLET PENGIRIM =====`);
  console.log("1. Gunakan private key dari file .env");
  console.log("2. Gunakan seed phrase dari file .env");
  console.log("3. Pilih wallet dari file JSON");
  
  const authMethod = prompt("Pilih metode (1-3): ");
  let senderKeypair;
  let senderPublicKey;
  
  if (authMethod === "1") {
    // Gunakan private key dari .env
    if (!process.env.SENDER_PRIVATE_KEY) {
      console.log("Private key tidak ditemukan di file .env!");
      console.log("Tambahkan SENDER_PRIVATE_KEY=<private_key_base58> ke file .env");
      return;
    }
    
    senderKeypair = getKeypairFromPrivateKey(process.env.SENDER_PRIVATE_KEY);
    if (!senderKeypair) {
      console.log("Private key tidak valid!");
      return;
    }
    
    senderPublicKey = senderKeypair.publicKey.toString();
    console.log(`\nMenggunakan wallet dengan public key: ${senderPublicKey}`);
    
  } else if (authMethod === "2") {
    // Gunakan seed phrase dari .env
    if (!process.env.SEED_PHRASE) {
      console.log("Seed phrase tidak ditemukan di file .env!");
      console.log("Tambahkan SEED_PHRASE=<mnemonic> ke file .env");
      return;
    }
    
    const derivationPath = process.env.DERIVATION_PATH || "m/44'/501'/0'/0'";
    console.log(`Menggunakan derivation path: ${derivationPath}`);
    
    try {
      senderKeypair = getKeypairFromMnemonic(process.env.SEED_PHRASE, derivationPath);
      senderPublicKey = senderKeypair.publicKey.toString();
      console.log(`\nMenggunakan wallet dengan public key: ${senderPublicKey}`);
    } catch (error) {
      console.error(`Error menggunakan seed phrase: ${error.message}`);
      return;
    }
    
  } else if (authMethod === "3") {
    // Pilih wallet dari file JSON
    // Minta lokasi file JSON wallet
    const walletFilePath = prompt("Masukkan lokasi file JSON wallet (default: solana_wallets.json): ") || "solana_wallets.json";
    
    // Load wallet data
    const walletData = loadWalletsFromJson(walletFilePath);
    
    if (!walletData) {
      console.error("Tidak dapat melanjutkan tanpa data wallet.");
      return;
    }
    
    console.log(`\n===== PILIH WALLET PENGIRIM =====`);
    
    // Tampilkan wallet dalam batch untuk memudahkan pemilihan
    const batchSize = 10;
    let currentBatch = 0;
    
    while (currentBatch * batchSize < walletData.wallets.length) {
      const start = currentBatch * batchSize;
      const end = Math.min(start + batchSize, walletData.wallets.length);
      
      console.log(`\nWallet ${start+1} - ${end}:`);
      
      for (let i = start; i < end; i++) {
        const wallet = walletData.wallets[i];
        console.log(`${i+1}. ${wallet.publicKey}`);
      }
      
      if (end < walletData.wallets.length) {
        const nextBatch = prompt("Tekan Enter untuk melihat lebih banyak wallet, atau masukkan nomor wallet untuk memilih: ");
        
        if (nextBatch.trim() === "") {
          currentBatch++;
        } else {
          const senderIndex = parseInt(nextBatch) - 1;
          
          if (isNaN(senderIndex) || senderIndex < 0 || senderIndex >= walletData.wallets.length) {
            console.log("Nomor wallet tidak valid!");
            continue;
          }
          
          // Wallet sender dipilih
          const senderWallet = walletData.wallets[senderIndex];
          senderKeypair = getKeypairFromMnemonic(walletData.mnemonic, senderWallet.path);
          senderPublicKey = senderWallet.publicKey;
          
          await processRecipients(senderKeypair, senderPublicKey);
          return;
        }
      } else {
        const senderIndex = parseInt(prompt("Masukkan nomor wallet pengirim: ")) - 1;
        
        if (isNaN(senderIndex) || senderIndex < 0 || senderIndex >= walletData.wallets.length) {
          console.log("Nomor wallet tidak valid!");
          continue;
        }
        
        // Wallet sender dipilih
        const senderWallet = walletData.wallets[senderIndex];
        senderKeypair = getKeypairFromMnemonic(walletData.mnemonic, senderWallet.path);
        senderPublicKey = senderWallet.publicKey;
        
        await processRecipients(senderKeypair, senderPublicKey);
        return;
      }
    }
  } else {
    console.log("Pilihan tidak valid!");
    return;
  }
  
  // Jika metode 1 atau 2 (menggunakan .env), lanjut ke proses penerima
  if (senderKeypair) {
    await processRecipients(senderKeypair, senderPublicKey);
  }
}

// Jalankan program
main();
