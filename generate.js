// Solana Multi-Wallet Generator
// Catatan: Kode ini hanya untuk tujuan pembelajaran. 
// Jangan gunakan untuk menyimpan dana dalam jumlah besar.
// Untuk menjalankan kode ini, install package berikut:
// npm install @solana/web3.js @solana/spl-token bip39 ed25519-hd-key bs58 prompt-sync
const { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const bs58 = require('bs58');
const fs = require('fs');
const prompt = require('prompt-sync')({ sigint: true });

// Fungsi untuk membuat mnemonic baru (seed phrase)
function generateMnemonic() {
  return bip39.generateMnemonic(256); // 24 kata
}

// Fungsi untuk derive keypair dari mnemonic dan path
function getKeypairFromMnemonic(mnemonic, derivationPath) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedKey = derivePath(derivationPath, seed.toString('hex'));
  const keypair = Keypair.fromSeed(derivedKey.key);
  return keypair;
}

// Fungsi untuk membuat banyak wallet dari satu mnemonic
async function generateMultipleWallets(mnemonic, count) {
  const wallets = [];
  console.log(`Seed Phrase (SIMPAN DENGAN AMAN): ${mnemonic}`);
  console.log("=".repeat(80));
  
  for (let i = 0; i < count; i++) {
    // Path untuk Solana mengikuti format: m/44'/501'/walletIndex'/0'
    const path = `m/44'/501'/${i}'/0'`;
    const keypair = getKeypairFromMnemonic(mnemonic, path);
    
    const wallet = {
      index: i,
      path: path,
      publicKey: keypair.publicKey.toString(),
      privateKey: bs58.encode(keypair.secretKey),
    };
    
    wallets.push(wallet);
    
    console.log(`Wallet #${i+1}`);
    console.log(`Path: ${path}`);
    console.log(`Public Key: ${wallet.publicKey}`);
    console.log(`Private Key: ${wallet.privateKey}`);
    console.log("-".repeat(80));
  }
  
  // Simpan informasi wallet ke file
  const data = {
    mnemonic: mnemonic,
    wallets: wallets
  };
  
  fs.writeFileSync('solana_wallets.json', JSON.stringify(data, null, 2));
  console.log(`Data wallet telah disimpan ke solana_wallets.json`);
  
  return wallets;
}

// Fungsi untuk load wallet dari file
function loadWallets() {
  try {
    const data = fs.readFileSync('solana_wallets.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error membaca file wallet:', error.message);
    return null;
  }
}

// Fungsi untuk menyimpan seed phrase ke file terpisah
function saveSeedPhrase(mnemonic) {
  try {
    // Buat nama file dengan timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `seed_phrase_${timestamp}.txt`;
    
    // Tulis seed phrase ke file
    fs.writeFileSync(filename, mnemonic);
    console.log(`Seed phrase berhasil disimpan ke file: ${filename}`);
    console.log("PERINGATAN: Simpan file ini dengan sangat aman!");
    return true;
  } catch (error) {
    console.error(`Error menyimpan seed phrase: ${error}`);
    return false;
  }
}

// Fungsi untuk mengirim dari banyak wallet ke satu wallet
async function sendFromMultipleWallets(mnemonicPhrase, sourceWalletIndices, destinationAddress, amountPerWallet) {
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=8dc65132-e52c-42bb-8bda-b9d339343b90', 'confirmed');
  let successCount = 0;
  let failCount = 0;
  
  console.log(`\nMemulai transfer batch dari ${sourceWalletIndices.length} wallet ke ${destinationAddress}`);
  console.log("=".repeat(50));
  
  for (let i = 0; i < sourceWalletIndices.length; i++) {
    const walletIndex = sourceWalletIndices[i];
    const path = `m/44'/501'/${walletIndex}'/0'`;
    const keypair = getKeypairFromMnemonic(mnemonicPhrase, path);
    
    // Cek saldo terlebih dahulu
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`\nProses wallet #${walletIndex+1} (${keypair.publicKey.toString()})`);
    console.log(`Saldo: ${solBalance} SOL`);
    
    if (balance < amountPerWallet * LAMPORTS_PER_SOL) {
      console.log(`Saldo tidak mencukupi untuk transfer ${amountPerWallet} SOL. Melewati wallet ini.`);
      failCount++;
      continue;
    }
    
    // Buat transaksi
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(destinationAddress),
        lamports: Math.floor(amountPerWallet * LAMPORTS_PER_SOL),
      })
    );
    
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );
      
      console.log(`Transfer sukses!`);
      console.log(`- Dari: ${keypair.publicKey.toString()}`);
      console.log(`- Ke: ${destinationAddress}`);
      console.log(`- Jumlah: ${amountPerWallet} SOL`);
      console.log(`- Signature: ${signature}`);
      
      successCount++;
    } catch (error) {
      console.error(`Error saat transfer: ${error}`);
      failCount++;
    }
  }
  
  console.log("\n=".repeat(50));
  console.log(`Hasil batch transfer:`);
  console.log(`- Sukses: ${successCount} wallet`);
  console.log(`- Gagal: ${failCount} wallet`);
  
  return { success: successCount, fail: failCount };
}

// Fungsi untuk mendapatkan saldo wallet
async function getWalletBalance(publicKey) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL; // Konversi dari lamports ke SOL
  } catch (error) {
    console.error(`Error mendapatkan saldo: ${error}`);
    return 0;
  }
}

// Fungsi untuk transfer SOL antara wallet
async function sendSolanaToWallet(mnemonicPhrase, fromWalletIndex, toWalletAddress, amountInSol) {
  // Koneksi ke jaringan Solana (devnet untuk testing)
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=8dc65132-e52c-42bb-8bda-b9d339343b90', 'confirmed');
  
  // Dapatkan keypair dari wallet pengirim berdasarkan index
  const fromPath = `m/44'/501'/${fromWalletIndex}'/0'`;
  const fromKeypair = getKeypairFromMnemonic(mnemonicPhrase, fromPath);
  
  // Konversi jumlah SOL ke lamports (1 SOL = 1,000,000,000 lamports)
  const lamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);
  
  // Buat objek PublicKey dari alamat tujuan
  const toPublicKey = new PublicKey(toWalletAddress);
  
  // Buat dan kirim transaksi
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports: lamports,
    })
  );
  
  try {
    // Cek saldo sebelum transaksi
    const balance = await connection.getBalance(fromKeypair.publicKey);
    console.log(`Saldo wallet pengirim: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < lamports) {
      console.error('Error: Saldo tidak mencukupi untuk transfer ini');
      return null;
    }
    
    // Kirim dan konfirmasi transaksi
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    console.log(`Transfer sukses!`);
    console.log(`Detail:`);
    console.log(`- Dari: ${fromKeypair.publicKey.toString()}`);
    console.log(`- Ke: ${toWalletAddress}`);
    console.log(`- Jumlah: ${amountInSol} SOL`);
    console.log(`- Signature: ${signature}`);
    console.log(`- Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    return signature;
  } catch (error) {
    console.error(`Error saat transfer: ${error}`);
    return null;
  }
}

// Fungsi untuk menampilkan menu
function displayMenu() {
  console.log("\n===== SOLANA MULTI-WALLET GENERATOR & MANAGER =====");
  console.log("1. Buat wallet baru");
  console.log("2. Lihat wallet yang ada");
  console.log("3. Kirim SOL");
  console.log("4. Cek saldo wallet");
  console.log("5. Simpan seed phrase");
  console.log("6. Kirim dari banyak wallet ke 1 wallet");
  console.log("7. Keluar");
  console.log("=".repeat(50));
  
  const choice = prompt("Pilih menu (1-7): ");
  return choice;
}

// Fungsi utama
async function main() {
  let walletData = loadWallets();
  let running = true;
  
  while (running) {
    const choice = displayMenu();
    
    switch (choice) {
      case "1":
        // Buat wallet baru
        const useSaved = prompt("Gunakan mnemonic yang tersimpan? (y/n): ").toLowerCase() === 'y';
        let mnemonic;
        
        if (useSaved && walletData) {
          mnemonic = walletData.mnemonic;
        } else {
          mnemonic = generateMnemonic();
        }
        
        const count = parseInt(prompt("Jumlah wallet yang ingin dibuat: "));
        
        if (isNaN(count) || count <= 0) {
          console.log("Jumlah wallet tidak valid!");
          break;
        }
        
        walletData = { mnemonic, wallets: await generateMultipleWallets(mnemonic, count) };
        break;
        
      case "2":
        // Lihat wallet yang ada
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }
        
        console.log("\n===== DAFTAR WALLET =====");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`Wallet #${i+1} - ${wallet.publicKey}`);
        });
        break;
        
      case "3":
        // Kirim SOL
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }
        
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`${i+1}. ${wallet.publicKey}`);
        });
        
        const fromIndex = parseInt(prompt("Pilih nomor wallet pengirim: ")) - 1;
        
        if (isNaN(fromIndex) || fromIndex < 0 || fromIndex >= walletData.wallets.length) {
          console.log("Nomor wallet tidak valid!");
          break;
        }
        
        // Cek saldo terlebih dahulu
        const senderPublicKey = walletData.wallets[fromIndex].publicKey;
        const senderBalance = await getWalletBalance(senderPublicKey);
        console.log(`Saldo wallet: ${senderBalance} SOL`);
        
        if (senderBalance <= 0) {
          console.log("Wallet pengirim tidak memiliki saldo cukup!");
          console.log("Untuk testing, dapatkan SOL gratis dari faucet:");
          console.log("- https://solfaucet.com");
          console.log("- https://faucet.solana.com");
          break;
        }
        
        const receiveOption = prompt("Kirim ke wallet sendiri (s) atau alamat eksternal (e)? ").toLowerCase();
        let receiverAddress;
        
        if (receiveOption === 's') {
          console.log("\n===== PILIH WALLET PENERIMA =====");
          walletData.wallets.forEach((wallet, i) => {
            console.log(`${i+1}. ${wallet.publicKey}`);
          });
          
          const toIndex = parseInt(prompt("Pilih nomor wallet penerima: ")) - 1;
          
          if (isNaN(toIndex) || toIndex < 0 || toIndex >= walletData.wallets.length) {
            console.log("Nomor wallet tidak valid!");
            break;
          }
          
          receiverAddress = walletData.wallets[toIndex].publicKey;
        } else {
          receiverAddress = prompt("Masukkan alamat penerima: ");
          try {
            // Validasi alamat publik
            new PublicKey(receiverAddress);
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        }
        
        const amount = parseFloat(prompt("Jumlah SOL yang akan dikirim: "));
        
        if (isNaN(amount) || amount <= 0 || amount > senderBalance) {
          console.log("Jumlah tidak valid atau melebihi saldo!");
          break;
        }
        
        console.log(`\nMengirim ${amount} SOL dari ${senderPublicKey} ke ${receiverAddress}...`);
        await sendSolanaToWallet(walletData.mnemonic, fromIndex, receiverAddress, amount);
        break;
        
      case "4":
        // Cek saldo wallet
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }
        
        console.log("\n===== PILIH WALLET =====");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`${i+1}. ${wallet.publicKey}`);
        });
        
        const walletIndex = parseInt(prompt("Pilih nomor wallet: ")) - 1;
        
        if (isNaN(walletIndex) || walletIndex < 0 || walletIndex >= walletData.wallets.length) {
          console.log("Nomor wallet tidak valid!");
          break;
        }
        
        const publicKey = walletData.wallets[walletIndex].publicKey;
        const balance = await getWalletBalance(publicKey);
        
        console.log(`\nSaldo wallet #${walletIndex+1}:`);
        console.log(`Alamat: ${publicKey}`);
        console.log(`Saldo: ${balance} SOL`);
        
        break;
        
      case "5":
        // Simpan seed phrase
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }
        
        console.log("\n===== SIMPAN SEED PHRASE =====");
        console.log("PERINGATAN: Seed phrase memberikan akses penuh ke semua wallet Anda!");
        console.log("Pastikan untuk menyimpannya di tempat yang sangat aman.");
        
        const confirmSave = prompt("Lanjutkan menyimpan seed phrase? (y/n): ").toLowerCase();
        
        if (confirmSave === 'y') {
          saveSeedPhrase(walletData.mnemonic);
        } else {
          console.log("Batal menyimpan seed phrase.");
        }
        break;
        
      case "6":
        // Kirim dari banyak wallet ke 1 wallet
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }
        
        console.log("\n===== KIRIM DARI BANYAK WALLET KE 1 WALLET =====");
        
        // 1. Pilih wallet penerima
        console.log("\n===== PILIH WALLET PENERIMA =====");
        console.log("Pilih opsi penerima:");
        console.log("1. Salah satu wallet sendiri");
        console.log("2. Alamat eksternal");
        
        const receiverOption = prompt("Pilih (1-2): ");
        let destinationAddress;
        
        if (receiverOption === "1") {
          // Tampilkan daftar wallet
          console.log("\nDaftar wallet Anda:");
          walletData.wallets.forEach((wallet, i) => {
            console.log(`${i+1}. ${wallet.publicKey}`);
          });
          
          const receiverIndex = parseInt(prompt("Pilih nomor wallet penerima: ")) - 1;
          
          if (isNaN(receiverIndex) || receiverIndex < 0 || receiverIndex >= walletData.wallets.length) {
            console.log("Nomor wallet tidak valid!");
            break;
          }
          
          destinationAddress = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption === "2") {
          destinationAddress = prompt("Masukkan alamat penerima: ");
          try {
            // Validasi alamat publik
            new PublicKey(destinationAddress);
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        } else {
          console.log("Pilihan tidak valid!");
          break;
        }
        
        // 2. Pilih wallet pengirim (multiple)
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        console.log("Daftar wallet Anda:");
        
        // Tampilkan daftar wallet dengan saldo
        const walletBalances = [];
        console.log("Mengambil info saldo untuk semua wallet...");
        
        for (let i = 0; i < walletData.wallets.length; i++) {
          const wallet = walletData.wallets[i];
          const balance = await getWalletBalance(wallet.publicKey);
          walletBalances.push({ index: i, balance });
          console.log(`${i+1}. ${wallet.publicKey} - ${balance} SOL`);
        }
        
        // Pilih cara memilih wallet
        console.log("\nCara memilih wallet pengirim:");
        console.log("1. Pilih semua wallet yang memiliki saldo");
        console.log("2. Pilih wallet dengan range tertentu (misal: 1-10)");
        console.log("3. Pilih wallet secara manual (misal: 1,3,5,7)");
        
        const selectionMethod = prompt("Pilih (1-3): ");
        let selectedIndices = [];
        
        if (selectionMethod === "1") {
          // Pilih semua wallet yang memiliki saldo
          selectedIndices = walletBalances
            .filter(item => item.balance > 0)
            .map(item => item.index);
            
          console.log(`${selectedIndices.length} wallet dengan saldo dipilih.`);
        } 
        else if (selectionMethod === "2") {
          // Pilih wallet dengan range
          const range = prompt("Masukkan range (misal: 1-10): ");
          const [start, end] = range.split('-').map(x => parseInt(x) - 1);
          
          if (isNaN(start) || isNaN(end) || start < 0 || end >= walletData.wallets.length || start > end) {
            console.log("Range tidak valid!");
            break;
          }
          
          for (let i = start; i <= end; i++) {
            selectedIndices.push(i);
          }
          
          console.log(`${selectedIndices.length} wallet dalam range dipilih.`);
        } 
        else if (selectionMethod === "3") {
          // Pilih wallet secara manual
          const manual = prompt("Masukkan nomor wallet dipisahkan koma (misal: 1,3,5,7): ");
          selectedIndices = manual.split(',')
            .map(x => parseInt(x.trim()) - 1)
            .filter(x => !isNaN(x) && x >= 0 && x < walletData.wallets.length);
            
          console.log(`${selectedIndices.length} wallet dipilih secara manual.`);
        } 
        else {
          console.log("Pilihan tidak valid!");
          break;
        }
        
        if (selectedIndices.length === 0) {
          console.log("Tidak ada wallet yang dipilih!");
          break;
        }
        
        // 3. Jumlah SOL per wallet
        const amountPerWallet = parseFloat(prompt("Jumlah SOL yang akan dikirim dari setiap wallet: "));
        
        if (isNaN(amountPerWallet) || amountPerWallet <= 0) {
          console.log("Jumlah tidak valid!");
          break;
        }
        
        // Konfirmasi
        console.log("\n===== KONFIRMASI TRANSFER BATCH =====");
        console.log(`Wallet pengirim: ${selectedIndices.length} wallet`);
        console.log(`Wallet penerima: ${destinationAddress}`);
        console.log(`Jumlah per wallet: ${amountPerWallet} SOL`);
        console.log(`Total (estimasi): ${selectedIndices.length * amountPerWallet} SOL`);
        
        const confirmBatch = prompt("Konfirmasi transfer batch? (y/n): ").toLowerCase();
        
        if (confirmBatch === 'y') {
          // Eksekusi transfer batch
          await sendFromMultipleWallets(
            walletData.mnemonic,
            selectedIndices,
            destinationAddress,
            amountPerWallet
          );
        } else {
          console.log("Transfer batch dibatalkan.");
        }
        break;
        
      case "7":
        console.log("Terima kasih telah menggunakan Solana Multi-Wallet Generator & Manager!");
        running = false;
        break;
        
      default:
        console.log("Pilihan tidak valid!");
    }
    
    if (running) {
      prompt("\nTekan Enter untuk melanjutkan...");
    }
  }
}

// Jalankan program
main();
