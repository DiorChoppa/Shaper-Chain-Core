//Create a block (it has to be imutable)
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec, ec = new EC("secp256k1");

const MINT_PRIVATE_ADRESS = "0700a1ad28a20e5b2a517c00242d3e25a88d84bf54dce9e1733e6096e6d6495e";
const MINT_KEY_PAIR = ec.keyFromPrivate(MINT_PRIVATE_ADRESS, "hex")
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic("hex");

let index = 0;

// public key: keyPair.getPublic("hex")
// private key keyPair.getPrivate("hex")


class Block {
    constructor(timestamp = "", data = []) {
		this.index = index;
		this.timestamp = timestamp;
        this.data = data;
        this.hash = Block.getHash(this);
        this.prevHash = "";
		this.nonce = 0;
		this.reward = 297;
    }

    static getHash(block) {
        return SHA256(JSON.stringify(block.data) + block.timestamp + block.prevHash + block.nonce);
    }

	mine(difficulty) {
		this.nonce = 0;
		while(!this.hash.startsWith(Array(difficulty + 1).join("0"))) {
			this.nonce++;
			this.hash = Block.getHash(this);
		}

		console.log("Block mined: " + this.hash);
	}

	static hasValidTransactions(block, chain) {
		let gas = 0, reward = 0;

		block.data.forEach(transaction => {
			if (transaction.from !== MINT_PUBLIC_ADDRESS) {
				gas += transaction.gas;
			} else {
				reward = transaction.amount;
			}
		});

		return (
			reward - gas === chain.reward &&
			block.data.every(transaction => Transaction.isValid(transaction, chain)) &&
			block.data.filter(transaction => transaction.from === MINT_PUBLIC_ADDRESS).length === 1	
		);
	}
}

class Blockchain {
    constructor() {
		const initialCoinRelease = new Transaction(MINT_PUBLIC_ADDRESS, "04719af634ece3e9bf00bfd7c58163b2caf2b8acd1a437a3e99a093c8dd7b1485c20d8a4c9f6621557f1d583e0fcff99f3234dd1bb365596d1d67909c270c16d64", 100000)
        this.chain = [new Block("", [initialCoinRelease])];
		this.difficulty = 1;
		this.blockTime = 30000;
		this.transactions = [];
		this.reward = 297;
		this.index = 0;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

	getBalance(address) {
		let balance = 0;

		this.chain.forEach(block => {
			block.data.forEach(transaction => {
				if (transaction.from === address) {
					balance -= transaction.amount;
					balance -= transaction.gas;
				}

				if(transaction.to === address) {
					balance += transaction.amount;
				}
			})
		})

		return balance;
	}

	//createGenesisBlock() {
	//	return new Block(Date.now().toString(), "Genesis block");
	//}

    addBlock(block) {
        block.prevHash = this.getLastBlock().hash;
        block.hash = Block.getHash(block);

		block.mine(this.difficulty);

        this.chain.push(block);

		this.difficulty += Date.now() - parseInt(this.getLastBlock().timestamp) < this.blockTime ? 1 : -1;
		//this.difficulty += (Shaper.chain.length * 60000)/this.blockTime;
		//this.difficulty *= Math.round(Math.log(16, this.difficulty));
		index++;
    }

	addTransaction(transaction) {
		if (Transaction.isValid(transaction, this)) {
			this.transactions.push(transaction);
		}
	}

	mineTransactions(rewardAddress) {
		let gas = 0;

		this.transactions.forEach(transaction => {
			gas += transaction.gas;
		})

		const rewardTransaction = new Transaction(MINT_PUBLIC_ADDRESS, rewardAddress, this.reward + gas);
		rewardTransaction.sign(MINT_KEY_PAIR);
		
		if (this.transactions.length !== 0) this.addBlock(new Block(Date.now().toString(), [rewardTransaction, ...this.transactions]));

		this.transactions = [];
	}

    static isValid(blockchain) {
        for (let i = 1; i < blockchain.chain.length; i++) {
            const	currBlock = blockchain.chain[i];
            const	prevBlock = blockchain.chain[i-1];

			if (
				currBlock.hash !== Block.getHash(currBlock) ||
				prevBlock.hash !== currBlock.prevHash ||
				!Block.hasValidTransactions(currBlock, blockchain)
				) {
				return false;
			}
        }

		return true;
    }
}

class Transaction {
	constructor(from, to, amount, gas = 0) {
		this.from = from;
		this.to = to;
		this.amount = amount;
		this.gas = gas;
	}

	sign(keyPair) {
		if (keyPair.getPublic("hex") === this.from) {
			this.signature = keyPair.sign(SHA256(this.from + this.to + this.amount + this.gas), "base64").toDER("hex");
		}
	}

	static isValid(tx, chain) {
		return (
			tx.from &&
			tx.to &&
			tx.amount &&
			(chain.getBalance(tx.from) >= tx.amount + tx.gas || tx.from === MINT_PUBLIC_ADDRESS) &&
			ec.keyFromPublic(tx.from, "hex").verify(SHA256(tx.from + tx.to + tx.amount + tx.gas), tx.signature)
		)
	}
}

const Shaper = new Blockchain();

module.exports = { Block, Blockchain, Shaper, Transaction}