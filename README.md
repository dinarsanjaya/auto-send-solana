# Solana Wallet Generator & Sender

A powerful Node.js tool for generating and managing multiple Solana wallets from a single seed phrase, and performing batch operations.

## Repository Structure

- `generate.js` - Generate multiple Solana wallets from a seed phrase
- `send.js` - Send SOL or tokens between wallets
- `.env-example` - Example environment variables (copy to `.env` for use)
- `package.json` - Project dependencies

## 🔧 Installation

1. Clone this repository:
```bash
git clone https://github.com/dinarsanjaya/auto-send-solana.git
cd auto-send-solana
```

2. Install the required packages:
```bash
npm install
```

3. Create your `.env` file from the example:
```bash
cp .env-example .env
```

4. Edit the `.env` file with your preferred settings

## 🚀 Using the Wallet Generator

The `generate.js` script allows you to create multiple Solana wallets derived from a single seed phrase.

### Features

- Generate any number of HD wallets from one seed phrase
- Create new random seed phrase or use existing one
- Secure storage of wallet information
- BIP44 compliant derivation path (m/44'/501'/x'/0')

### Running the Generator

```bash
node generate.js
```

Follow the prompts to:
1. Choose whether to use an existing seed phrase or create a new one
2. Specify how many wallets to generate
3. View and save wallet details

### Generated Wallet Information

For each wallet, the generator outputs:
- Wallet index number
- Derivation path
- Public key (wallet address)
- Private key

All wallet information is saved to `solana_wallets.json` for future use.

## 🔄 Using the Send Functionality

The `send.js` script handles all transfer operations between wallets.

```bash
node send.js
```

This provides a menu to:
- Send SOL between wallets
- Send tokens between wallets
- Perform batch operations (sending from multiple wallets to one)
- Check wallet balances

## ⚙️ Configuration

The `.env-example` file shows the required environment variables:

```
RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

Replace with your own RPC endpoint or API key.

## 🔐 Security Notes

- Seed phrases and private keys are sensitive information
- The `solana_wallets.json` file contains private keys - secure appropriately
- For production use, consider additional security measures

## 📝 Technical Details

- Uses Solana Web3.js for blockchain interactions
- Implements BIP39 standard for mnemonic generation
- HD wallet derivation follows Solana's recommended path format
- Securely manages private keys and seed phrases

## 📄 License

This project is for educational purposes. Use at your own risk.

## 🙏 Requirements

- Node.js v14.0.0 or higher
- NPM v6.0.0 or higher
- Dependencies:
  - @solana/web3.js
  - @solana/spl-token
  - bip39
  - ed25519-hd-key
  - bs58
  - prompt-sync
