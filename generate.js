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

// Fungsi untuk mendapatkan saldo wallet
async function getWalletBalance(publicKey) {
  const connection = new Connection('https://warmhearted-flashy-log.solana-mainnet.quiknode.pro/f3bd07d7ed5eb162efdcf0aab4ae21bd1847a156/', 'confirmed');
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
  // Koneksi ke jaringan Solana
  const connection = new Connection('https://warmhearted-flashy-log.solana-mainnet.quiknode.pro/f3bd07d7ed5eb162efdcf0aab4ae21bd1847a156/', 'confirmed');
  
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
    console.log(`- Explorer: https://explorer.solana.com/tx/${signature}`);
    
    return signature;
  } catch (error) {
    console.error(`Error saat transfer: ${error}`);
    return null;
  }
}

// Fungsi untuk mengirim dari banyak wallet ke satu wallet
async function sendFromMultipleWallets(mnemonicPhrase, sourceWalletIndices, destinationAddress, amountPerWallet) {
  const connection = new Connection('https://warmhearted-flashy-log.solana-mainnet.quiknode.pro/f3bd07d7ed5eb162efdcf0aab4ae21bd1847a156/', 'confirmed');
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

// Fungsi untuk memproses input range dan individual wallet
function processWalletSelection(input, totalWallets) {
  const selectedIndices = [];
  const parts = input.split(',');
  
  console.log(`\nMemproses input pemilihan wallet: "${input}"`);
  
  for (const part of parts) {
    const trimmedPart = part.trim();
    
    // Cek apakah ini adalah range (contoh: "1-10")
    if (trimmedPart.includes('-')) {
      const [start, end] = trimmedPart.split('-').map(x => parseInt(x.trim()));
      
      // Validasi range
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= totalWallets && start <= end) {
        console.log(`Memilih range wallet ${start} sampai ${end}`);
        for (let i = start; i <= end; i++) {
          selectedIndices.push(i - 1); // Convert to zero-based index
        }
      } else {
        console.log(`Range tidak valid: ${trimmedPart}. Harap masukkan range dalam batas 1-${totalWallets}.`);
      }
    } 
    // Cek apakah ini adalah angka individual
    else {
      const index = parseInt(trimmedPart);
      if (!isNaN(index) && index >= 1 && index <= totalWallets) {
        selectedIndices.push(index - 1); // Convert to zero-based index
      } else if (!isNaN(index)) {
        console.log(`Nomor wallet tidak valid: ${index}. Harap masukkan nomor antara 1-${totalWallets}.`);
      }
    }
  }
  
  // Hapus duplikat jika ada
  const uniqueIndices = [...new Set(selectedIndices)];
  console.log(`Total wallet yang dipilih: ${uniqueIndices.length}`);
  
  return uniqueIndices;
}

// Fungsi untuk mengirimkan sisa saldo (maksimal) dari setiap wallet ke satu tujuan
async function sendMaxBalanceFromMultipleWallets(mnemonicPhrase, sourceWalletIndices, destinationAddress) {
  const connection = new Connection('https://warmhearted-flashy-log.solana-mainnet.quiknode.pro/f3bd07d7ed5eb162efdcf0aab4ae21bd1847a156/', 'confirmed');
  let successCount = 0;
  let failCount = 0;
  
  // Sortir dan hapus duplikat pada indeks wallet
  sourceWalletIndices = [...new Set(sourceWalletIndices)].sort((a, b) => a - b);
  
  if (sourceWalletIndices.length === 0) {
    console.log("Tidak ada wallet yang dipilih untuk transfer.");
    return { success: 0, fail: 0 };
  }

  console.log(`\nMemulai transfer batch (saldo penuh) dari ${sourceWalletIndices.length} wallet ke ${destinationAddress}`);
  console.log("=".repeat(50));

  for (let i = 0; i < sourceWalletIndices.length; i++) {
    const walletIndex = sourceWalletIndices[i];
    const path = `m/44'/501'/${walletIndex}'/0'`;
    const keypair = getKeypairFromMnemonic(mnemonicPhrase, path);

    // Cek saldo terlebih dahulu
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`\nProses wallet #${walletIndex + 1} (${keypair.publicKey.toString()})`);
    console.log(`Saldo: ${solBalance} SOL`);

    // Periksa apakah saldo mencukupi untuk mentransfer
    const minimumBalance = 5000; // Minimum balance required (5000 lamports)
    
    if (balance <= minimumBalance) {
      console.log(`Saldo tidak mencukupi untuk membayar biaya transaksi. Melewati wallet ini.`);
      failCount++;
      continue;
    }

    try {
      // Buat transaksi untuk menghitung ukuran dan biaya terlebih dahulu
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(destinationAddress),
          lamports: balance - minimumBalance, // Akan diupdate dengan nilai sebenarnya setelah simulasi
        })
      );
      
      // Siapkan transaksi
      const blockHash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockHash.blockhash;
      transaction.feePayer = keypair.publicKey;
      
      // Estimasi biaya transaksi dengan simulasi
      const simulationResult = await connection.simulateTransaction(transaction);
      
      if (simulationResult.value.err) {
        console.log(`Simulasi transaksi gagal: ${JSON.stringify(simulationResult.value.err)}`);
        failCount++;
        continue;
      }
      
      // Dapatkan biaya transaksi dari simulasi
      const transactionFee = simulationResult.value.fee || 5000; // Default ke 5000 lamports jika tidak bisa mendapatkan fee
      console.log(`Biaya transaksi: ${transactionFee / LAMPORTS_PER_SOL} SOL`);
      
      // Periksa kembali saldo setelah mengetahui biaya transaksi yang sebenarnya
      if (balance <= transactionFee) {
        console.log(`Saldo tidak mencukupi untuk membayar biaya transaksi. Melewati wallet ini.`);
        failCount++;
        continue;
      }
      
      // Hitung jumlah yang bisa dikirim (saldo - biaya transaksi)
      const amountToSend = balance - transactionFee;
      
      // Update transaksi dengan jumlah yang benar
      transaction.instructions[0] = SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(destinationAddress),
        lamports: amountToSend,
      });

      // Tanda tangani dan kirim transaksi
      transaction.sign(keypair);
      const signature = await connection.sendTransaction(transaction, [keypair], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      // Konfirmasi transaksi
      await connection.confirmTransaction({
        signature,
        blockhash: blockHash.blockhash,
        lastValidBlockHeight: blockHash.lastValidBlockHeight
      }, 'confirmed');

      console.log(`Transfer sukses!`);
      console.log(`- Dari: ${keypair.publicKey.toString()}`);
      console.log(`- Ke: ${destinationAddress}`);
      console.log(`- Jumlah: ${amountToSend / LAMPORTS_PER_SOL} SOL`);
      console.log(`- Signature: ${signature}`);

      successCount++;
    } catch (error) {
      // Menangani error dan menampilkan log untuk analisis lebih lanjut
      console.error(`Error saat transfer: ${error.message}`);
      
      // Cek apakah error memiliki detail simulasi
      if (error.logs) {
        console.log("Logs dari error:", error.logs);
      }
      
      failCount++;
    }
  }

  console.log("\n=".repeat(50));
  console.log(`Hasil batch transfer (saldo penuh):`);
  console.log(`- Sukses: ${successCount} wallet`);
  console.log(`- Gagal: ${failCount} wallet`);

  return { success: successCount, fail: failCount };
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
  console.log("7. Kirim seluruh saldo dari banyak wallet ke 1 wallet");
  console.log("8. Keluar");
  console.log("=".repeat(50));

  const choice = prompt("Pilih menu (1-8): ");
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

        const receiverOption6 = prompt("Pilih (1-2): ");
        let destinationAddress6;

        if (receiverOption6 === "1") {
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

          destinationAddress6 = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption6 === "2") {
          destinationAddress6 = prompt("Masukkan alamat penerima: ");
          try {
            // Validasi alamat publik
            new PublicKey(destinationAddress6);
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
        
        const selectionMethod6 = prompt("Pilih (1-3): ");
        let selectedIndices6 = [];
        
        if (selectionMethod6 === "1") {
          // Pilih semua wallet yang memiliki saldo
          selectedIndices6 = walletBalances
            .filter(item => item.balance > 0)
            .map(item => item.index);
            
          console.log(`${selectedIndices6.length} wallet dengan saldo dipilih.`);
        } 
        else if (selectionMethod6 === "2") {
          // Pilih wallet dengan range
          const range = prompt("Masukkan range (misal: 1-10): ");
          selectedIndices6 = processWalletSelection(range, walletData.wallets.length);
        } 
        else if (selectionMethod6 === "3") {
          // Pilih wallet secara manual
          const manual = prompt("Masukkan nomor wallet dipisahkan koma (misal: 1,3,5,7): ");
          selectedIndices6 = processWalletSelection(manual, walletData.wallets.length);
        } 
        else {
          console.log("Pilihan tidak valid!");
          break;
        }
        
        if (selectedIndices6.length === 0) {
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
        console.log(`Wallet pengirim: ${selectedIndices6.length} wallet`);
        console.log(`Wallet penerima: ${destinationAddress6}`);
        console.log(`Jumlah per wallet: ${amountPerWallet} SOL`);
        console.log(`Total (estimasi): ${selectedIndices6.length * amountPerWallet} SOL`);
        
        const confirmBatch = prompt("Konfirmasi transfer batch? (y/n): ").toLowerCase();
        
        if (confirmBatch === 'y') {
          // Eksekusi transfer batch
          await sendFromMultipleWallets(
            walletData.mnemonic,
            selectedIndices6,
            destinationAddress6,
            amountPerWallet
          );
        } else {
          console.log("Transfer batch dibatalkan.");
        }
        break;

      case "7":
        // Kirim seluruh saldo dari banyak wallet ke 1 wallet
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }

        console.log("\n===== KIRIM SELURUH SALDO DARI BANYAK WALLET KE 1 WALLET =====");

        // Pilih wallet penerima
        console.log("\n===== PILIH WALLET PENERIMA =====");
        console.log("Pilih opsi penerima:");
        console.log("1. Salah satu wallet sendiri");
        console.log("2. Alamat eksternal");
        
        const receiverOption7 = prompt("Pilih (1-2): ");
        let destinationAddress7;
        
        if (receiverOption7 === "1") {
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
          
          destinationAddress7 = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption7 === "2") {
          destinationAddress7 = prompt("Masukkan alamat penerima: ");
          try {
            // Validasi alamat publik
            new PublicKey(destinationAddress7);
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        } else {
          console.log("Pilihan tidak valid!");
          break;
        }

        // Pilih wallet pengirim (multiple)
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        
        // Tampilkan daftar wallet dengan saldo
        console.log("Mengambil info saldo untuk semua wallet...");
        const walletBalances7 = [];
        
        for (let i = 0; i < walletData.wallets.length; i++) {
          const wallet = walletData.wallets[i];
          const balance = await getWalletBalance(wallet.publicKey);
          walletBalances7.push({ index: i, balance });
          console.log(`${i+1}. ${wallet.publicKey} - ${balance} SOL`);
        }
        
        // Pilih cara memilih wallet
        console.log("\nCara memilih wallet pengirim:");
        console.log("1. Pilih semua wallet yang memiliki saldo");
        console.log("2. Pilih wallet dengan range tertentu (misal: 1-10)");
        console.log("3. Pilih wallet secara manual (misal: 1,3,5,7)");
        
        const selectionMethod7 = prompt("Pilih (1-3): ");
        let sourceWalletIndices;
        
        if (selectionMethod7 === "1") {
          // Pilih semua wallet yang memiliki saldo
          sourceWalletIndices = walletBalances7
            .filter(item => item.balance > 0)
            .map(item => item.index);
          
          console.log(`${sourceWalletIndices.length} wallet dengan saldo dipilih.`);
        } 
        else if (selectionMethod7 === "2") {
          // Pilih wallet dengan range dan format
          const rangeInput = prompt("Masukkan range (misal: 1-10 atau 1,3,5-10): ");
          sourceWalletIndices = processWalletSelection(rangeInput, walletData.wallets.length);
        }
        else if (selectionMethod7 === "3") {
          // Pilih wallet secara manual
          const manualInput = prompt("Masukkan nomor wallet dipisahkan koma (misal: 1,3,5,7): ");
          sourceWalletIndices = processWalletSelection(manualInput, walletData.wallets.length);
        }
        else {
          console.log("Pilihan tidak valid!");
          break;
        }
        
        if (sourceWalletIndices.length === 0) {
          console.log("Tidak ada wallet yang dipilih!");
          break;
        }
        
        // Konfirmasi
        console.log("\n===== KONFIRMASI TRANSFER BATCH (SALDO PENUH) =====");
        console.log(`Wallet pengirim: ${sourceWalletIndices.length} wallet`);
        console.log(`Wallet penerima: ${destinationAddress7}`);
        console.log(`Tindakan: Mengirim SELURUH SALDO dari setiap wallet`);
        
        const confirmMax = prompt("PERINGATAN: Ini akan mengirim SELURUH SALDO dari wallet yang dipilih. Lanjutkan? (y/n): ").toLowerCase();
        
        if (confirmMax === 'y') {
          // Eksekusi transfer seluruh saldo
          await sendMaxBalanceFromMultipleWallets(
            walletData.mnemonic,
            sourceWalletIndices,
            destinationAddress7
          );
        } else {
          console.log("Transfer batch dibatalkan.");
        }
        break;

      case "8":
        console.log("Terima kasih telah menggunakan Solana Multi-Wallet Generator & Manager!");
        running = false;
        break;

      default:
        console.log("Pilihan tidak valid!");
    }
  }
}

// Jalankan program
main(); 
