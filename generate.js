// Solana Multi-Wallet Generator
// Catatan: Kode ini hanya untuk tujuan pembelajaran. 
// Jangan gunakan untuk menyimpan dana dalam jumlah besar.
// Untuk menjalankan kode ini, install package berikut:
// npm install @solana/web3.js @solana/spl-token bip39 ed25519-hd-key bs58 prompt-sync
const { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, AccountLayout } = require('@solana/spl-token');
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

// Fungsi untuk mendapatkan token accounts dari wallet
async function getTokenAccounts(connection, publicKey) {
  try {
    // Dapatkan semua token accounts yang dimiliki oleh wallet
    const tokenResp = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(publicKey),
      { programId: TOKEN_PROGRAM_ID }
    );
    
    // Format data token untuk mudah dibaca
    const tokenAccounts = tokenResp.value.map(accountInfo => {
      const parsedInfo = accountInfo.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenBalance = parsedInfo.tokenAmount.uiAmount;
      const decimals = parsedInfo.tokenAmount.decimals;
      
      return {
        pubkey: accountInfo.pubkey.toString(),
        mint: mintAddress,
        owner: parsedInfo.owner,
        balance: tokenBalance,
        decimals: decimals,
        tokenAccount: accountInfo.pubkey.toString()
      };
    });
    
    return tokenAccounts;
  } catch (error) {
    console.error(`Error getting token accounts: ${error}`);
    return [];
  }
}

// Fungsi untuk mendapatkan metadata token
async function getTokenMetadata(connection, mintAddress) {
  try {
    // Implementasi sederhana, di produksi sebaiknya menggunakan Metaplex untuk metadata lengkap
    return {
      address: mintAddress,
      symbol: "TOKEN", // Default jika tidak bisa mendapatkan simbol sebenarnya
      name: "Unknown Token",
      decimals: 9, // Default decimals
    };
  } catch (error) {
    console.error(`Error getting token metadata: ${error}`);
    return {
      address: mintAddress,
      symbol: "TOKEN",
      name: "Unknown Token",
      decimals: 9,
    };
  }
}

// Fungsi untuk mengirim semua token dari wallet
async function sendAllTokens(connection, fromKeypair, destinationAddress, mintAddress, tokenAccount) {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const sourceTokenAccount = new PublicKey(tokenAccount);
    const destinationPublicKey = new PublicKey(destinationAddress);
    
    // Dapatkan atau buat token account di wallet tujuan
    let destinationTokenAccount;
    try {
      const receiverTokenAccounts = await connection.getParsedTokenAccountsByOwner(
        destinationPublicKey,
        { mint: mintPublicKey }
      );
      
      // Jika penerima sudah memiliki token account untuk token ini
      if (receiverTokenAccounts.value.length > 0) {
        destinationTokenAccount = receiverTokenAccounts.value[0].pubkey;
      } else {
        // Jika belum, kita perlu membuat token account baru untuk penerima
        // Namun untuk sederhananya, kita asumsikan token account sudah ada
        console.log(`Penerima belum memiliki token account untuk token ini.`);
        console.log(`Token account perlu dibuat terlebih dahulu.`);
        return null;
      }
    } catch (error) {
      console.error(`Error checking receiver token accounts: ${error}`);
      return null;
    }
    
    // Dapatkan info token account sumber
    const sourceAccountInfo = await connection.getParsedAccountInfo(sourceTokenAccount);
    if (!sourceAccountInfo.value) {
      console.log(`Token account sumber tidak ditemukan.`);
      return null;
    }
    
    const parsedSourceData = sourceAccountInfo.value.data.parsed.info;
    const tokenAmount = parsedSourceData.tokenAmount.amount;
    
    if (tokenAmount === '0') {
      console.log(`Saldo token adalah 0, tidak ada yang dikirim.`);
      return null;
    }
    
    // Buat dan kirim transaksi
    const transaction = new Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        sourceTokenAccount,
        destinationTokenAccount,
        fromKeypair.publicKey,
        [],
        parseInt(tokenAmount)
      )
    );
    
    // Siapkan transaksi
    const blockHash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockHash.blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // Tanda tangani dan kirim
    transaction.sign(fromKeypair);
    
    const signature = await connection.sendTransaction(transaction, [fromKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    // Konfirmasi transaksi
    await connection.confirmTransaction({
      signature,
      blockhash: blockHash.blockhash,
      lastValidBlockHeight: blockHash.lastValidBlockHeight
    }, 'confirmed');
    
    console.log(`Transfer token sukses!`);
    console.log(`- Dari: ${fromKeypair.publicKey.toString()}`);
    console.log(`- Ke: ${destinationAddress}`);
    console.log(`- Token: ${mintAddress}`);
    console.log(`- Jumlah: ${parsedSourceData.tokenAmount.uiAmount}`);
    console.log(`- Signature: ${signature}`);
    console.log(`- Explorer: https://explorer.solana.com/tx/${signature}`);
    
    return signature;
  } catch (error) {
    console.error(`Error sending tokens: ${error}`);
    if (error.logs) {
      console.log("Logs dari error:", error.logs);
    }
    return null;
  }
}

// Fungsi untuk mengirim semua token dari banyak wallet
async function sendAllTokensFromMultipleWallets(mnemonicPhrase, sourceWalletIndices, destinationAddress, mintAddress) {
  const connection = new Connection('https://warmhearted-flashy-log.solana-mainnet.quiknode.pro/f3bd07d7ed5eb162efdcf0aab4ae21bd1847a156/', 'confirmed');
  let successCount = 0;
  let failCount = 0;
  
  // Sortir dan hapus duplikat pada indeks wallet
  sourceWalletIndices = [...new Set(sourceWalletIndices)].sort((a, b) => a - b);
  
  if (sourceWalletIndices.length === 0) {
    console.log("Tidak ada wallet yang dipilih untuk transfer.");
    return { success: 0, fail: 0 };
  }

  const mintPublicKey = new PublicKey(mintAddress);
  const tokenMetadata = await getTokenMetadata(connection, mintAddress);
  
  console.log(`\nMemulai transfer batch semua token ${tokenMetadata.symbol} dari ${sourceWalletIndices.length} wallet ke ${destinationAddress}`);
  console.log("=".repeat(50));

  for (let i = 0; i < sourceWalletIndices.length; i++) {
    const walletIndex = sourceWalletIndices[i];
    const path = `m/44'/501'/${walletIndex}'/0'`;
    const keypair = getKeypairFromMnemonic(mnemonicPhrase, path);

    console.log(`\nProses wallet #${walletIndex + 1} (${keypair.publicKey.toString()})`);
    
    // Dapatkan semua token accounts
    const tokenAccounts = await getTokenAccounts(connection, keypair.publicKey.toString());
    
    // Filter token accounts untuk token yang diminta
    const relevantTokenAccounts = tokenAccounts.filter(acc => acc.mint === mintAddress);
    
    if (relevantTokenAccounts.length === 0) {
      console.log(`Wallet ini tidak memiliki token ${mintAddress}. Melewati wallet ini.`);
      failCount++;
      continue;
    }
    
    for (const tokenAcc of relevantTokenAccounts) {
      console.log(`Token account: ${tokenAcc.tokenAccount}`);
      console.log(`Saldo: ${tokenAcc.balance} ${tokenMetadata.symbol}`);
      
      if (tokenAcc.balance <= 0) {
        console.log(`Saldo token adalah 0. Melewati token account ini.`);
        continue;
      }
      
      try {
        const signature = await sendAllTokens(
          connection,
          keypair,
          destinationAddress,
          mintAddress,
          tokenAcc.tokenAccount
        );
        
        if (signature) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Error saat transfer token: ${error.message}`);
        failCount++;
      }
    }
  }

  console.log("\n=".repeat(50));
  console.log(`Hasil batch transfer token:`);
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
  console.log("8. Kirim semua token dari banyak wallet ke 1 wallet");
  console.log("9. Keluar");
  console.log("=".repeat(50));

  const choice = prompt("Pilih menu (1-9): ");
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

        console.log("\n===== CEK SALDO WALLET =====");
        for (const wallet of walletData.wallets) {
          const balance = await getWalletBalance(wallet.publicKey);
          console.log(`Wallet #${wallet.index + 1}: ${wallet.publicKey} - ${balance} SOL`);
        }
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

        const receiverOption = prompt("Masukkan pilihan (1/2): ");
        let destinationAddress;

        if (receiverOption === "1") {
          // Pilih dari wallet sendiri
          console.log("\n===== DAFTAR WALLET =====");
          walletData.wallets.forEach((wallet, i) => {
            console.log(`${i+1}. ${wallet.publicKey}`);
          });

          const receiverIndex = parseInt(prompt("Pilih nomor wallet penerima: ")) - 1;
          if (isNaN(receiverIndex)) {
            console.log("Input tidak valid!");
            break;
          }

          destinationAddress = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption === "2") {
          // Input alamat eksternal
          destinationAddress = prompt("Masukkan alamat penerima: ");
          try {
            new PublicKey(destinationAddress); // Validasi alamat
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        } else {
          console.log("Pilihan tidak valid!");
          break;
        }

        // 2. Pilih wallet pengirim
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        console.log("Format input:");
        console.log("- Untuk memilih beberapa wallet: 1,3,5");
        console.log("- Untuk memilih range wallet: 1-10");
        console.log("- Bisa dikombinasikan: 1,3,5-10,15");
        console.log("\nDaftar wallet tersedia:");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`${i+1}. ${wallet.publicKey}`);
        });

        const walletSelection = prompt(`Masukkan nomor wallet pengirim (1-${walletData.wallets.length}): `);
        const selectedIndices = processWalletSelection(walletSelection, walletData.wallets.length);

        if (selectedIndices.length === 0) {
          console.log("Tidak ada wallet yang dipilih!");
          break;
        }

        // 3. Masukkan jumlah SOL yang akan dikirim dari setiap wallet
        const amountPerWallet = parseFloat(prompt("Jumlah SOL yang akan dikirim dari setiap wallet: "));
        if (isNaN(amountPerWallet)) {
          console.log("Jumlah tidak valid!");
          break;
        }

        // 4. Konfirmasi sebelum eksekusi
        console.log("\n===== KONFIRMASI =====");
        console.log(`Tujuan: ${destinationAddress}`);
        console.log(`Jumlah wallet pengirim: ${selectedIndices.length}`);
        console.log(`Jumlah per wallet: ${amountPerWallet} SOL`);
        console.log(`Total yang akan dikirim: ${amountPerWallet * selectedIndices.length} SOL`);

        const confirm = prompt("Lanjutkan? (y/n): ").toLowerCase();
        if (confirm !== 'y') {
          console.log("Transfer dibatalkan.");
          break;
        }

        // 5. Eksekusi transfer
        console.log("\nMemulai transfer...");
        await sendFromMultipleWallets(
          walletData.mnemonic,
          selectedIndices,
          destinationAddress,
          amountPerWallet
        );
        break;

      case "7":
        // Kirim seluruh saldo dari banyak wallet ke 1 wallet
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }

        console.log("\n===== KIRIM SELURUH SALDO DARI BANYAK WALLET KE 1 WALLET =====");

        // 1. Pilih wallet penerima
        console.log("\n===== PILIH WALLET PENERIMA =====");
        console.log("Pilih opsi penerima:");
        console.log("1. Salah satu wallet sendiri");
        console.log("2. Alamat eksternal");

        const receiverOption7 = prompt("Masukkan pilihan (1/2): ");
        let destinationAddress7;

        if (receiverOption7 === "1") {
          // Pilih dari wallet sendiri
          console.log("\n===== DAFTAR WALLET =====");
          walletData.wallets.forEach((wallet, i) => {
            console.log(`${i+1}. ${wallet.publicKey}`);
          });

          const receiverIndex = parseInt(prompt("Pilih nomor wallet penerima: ")) - 1;
          if (isNaN(receiverIndex)) {
            console.log("Input tidak valid!");
            break;
          }

          destinationAddress7 = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption7 === "2") {
          // Input alamat eksternal
          destinationAddress7 = prompt("Masukkan alamat penerima: ");
          try {
            new PublicKey(destinationAddress7); // Validasi alamat
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        } else {
          console.log("Pilihan tidak valid!");
          break;
        }

        // 2. Pilih wallet pengirim
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        console.log("Format input:");
        console.log("- Untuk memilih beberapa wallet: 1,3,5");
        console.log("- Untuk memilih range wallet: 1-10");
        console.log("- Bisa dikombinasikan: 1,3,5-10,15");
        console.log("\nDaftar wallet tersedia:");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`${i+1}. ${wallet.publicKey}`);
        });

        const walletSelection7 = prompt(`Masukkan nomor wallet pengirim (1-${walletData.wallets.length}): `);
        const selectedIndices7 = processWalletSelection(walletSelection7, walletData.wallets.length);

        if (selectedIndices7.length === 0) {
          console.log("Tidak ada wallet yang dipilih!");
          break;
        }

        // 3. Konfirmasi sebelum eksekusi
        console.log("\n===== KONFIRMASI =====");
        console.log(`Tujuan: ${destinationAddress7}`);
        console.log(`Jumlah wallet pengirim: ${selectedIndices7.length}`);
        console.log("Akan mengirim seluruh saldo dari setiap wallet");

        const confirm7 = prompt("Lanjutkan? (y/n): ").toLowerCase();
        if (confirm7 !== 'y') {
          console.log("Transfer dibatalkan.");
          break;
        }

        // 4. Eksekusi transfer
        console.log("\nMemulai transfer...");
        await sendMaxBalanceFromMultipleWallets(
          walletData.mnemonic,
          selectedIndices7,
          destinationAddress7
        );
        break;

      case "8":
        // Kirim semua token dari banyak wallet ke 1 wallet
        if (!walletData) {
          console.log("Tidak ada wallet tersimpan. Buat wallet baru terlebih dahulu.");
          break;
        }

        console.log("\n===== KIRIM SEMUA TOKEN DARI BANYAK WALLET KE 1 WALLET =====");

        // 1. Masukkan alamat token (mint address)
        const mintAddress = prompt("Masukkan alamat token (mint address) yang akan dikirim: ");
        try {
          new PublicKey(mintAddress); // Validasi alamat
        } catch (error) {
          console.log("Alamat token tidak valid!");
          break;
        }

        // 2. Pilih wallet penerima
        console.log("\n===== PILIH WALLET PENERIMA =====");
        console.log("Pilih opsi penerima:");
        console.log("1. Salah satu wallet sendiri");
        console.log("2. Alamat eksternal");

        const receiverOption8 = prompt("Masukkan pilihan (1/2): ");
        let destinationAddress8;

        if (receiverOption8 === "1") {
          // Pilih dari wallet sendiri
          console.log("\n===== DAFTAR WALLET =====");
          walletData.wallets.forEach((wallet, i) => {
            console.log(`${i+1}. ${wallet.publicKey}`);
          });

          const receiverIndex = parseInt(prompt("Pilih nomor wallet penerima: ")) - 1;
          if (isNaN(receiverIndex)) {
            console.log("Input tidak valid!");
            break;
          }

          destinationAddress8 = walletData.wallets[receiverIndex].publicKey;
        } else if (receiverOption8 === "2") {
          // Input alamat eksternal
          destinationAddress8 = prompt("Masukkan alamat penerima: ");
          try {
            new PublicKey(destinationAddress8); // Validasi alamat
          } catch (error) {
            console.log("Alamat Solana tidak valid!");
            break;
          }
        } else {
          console.log("Pilihan tidak valid!");
          break;
        }

        // 3. Pilih wallet pengirim
        console.log("\n===== PILIH WALLET PENGIRIM =====");
        console.log("Format input:");
        console.log("- Untuk memilih beberapa wallet: 1,3,5");
        console.log("- Untuk memilih range wallet: 1-10");
        console.log("- Bisa dikombinasikan: 1,3,5-10,15");
        console.log("\nDaftar wallet tersedia:");
        walletData.wallets.forEach((wallet, i) => {
          console.log(`${i+1}. ${wallet.publicKey}`);
        });

        const walletSelection8 = prompt(`Masukkan nomor wallet pengirim (1-${walletData.wallets.length}): `);
        const selectedIndices8 = processWalletSelection(walletSelection8, walletData.wallets.length);

        if (selectedIndices8.length === 0) {
          console.log("Tidak ada wallet yang dipilih!");
          break;
        }

        // 4. Konfirmasi sebelum eksekusi
        console.log("\n===== KONFIRMASI =====");
        console.log(`Token: ${mintAddress}`);
        console.log(`Tujuan: ${destinationAddress8}`);
        console.log(`Jumlah wallet pengirim: ${selectedIndices8.length}`);
        console.log("Akan mengirim semua token dari setiap wallet");

        const confirm8 = prompt("Lanjutkan? (y/n): ").toLowerCase();
        if (confirm8 !== 'y') {
          console.log("Transfer dibatalkan.");
          break;
        }

        // 5. Eksekusi transfer
        console.log("\nMemulai transfer...");
        await sendAllTokensFromMultipleWallets(
          walletData.mnemonic,
          selectedIndices8,
          destinationAddress8,
          mintAddress
        );
        break;

      case "9":
        // Keluar dari program
        console.log("Keluar dari program...");
        running = false;
        break;

      default:
        console.log("Pilihan tidak valid! Silakan pilih 1-9.");
    }
  }
}

// Jalankan program
main().catch(console.error);
