const { ethers } = require("ethers");

const RPC_URL = `https://rpc.soneium.org`;

const provider = new ethers.JsonRpcProvider(RPC_URL);

const ERC721_ABI = [
  "function supportsInterface(bytes4 interfaceID) external view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const ERC721_INTERFACE_ID = "0x80ac58cd";
const TRANSFER_EVENT_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function processBlock(blockNumber) {
  console.log(`Processing block ${blockNumber}`);
  try {
    const block = await provider.getBlock(blockNumber, { includeTransactions: true });
    
    // deployed contracts
    for (const tx of block.transactions) {
      if (!tx.to) {
        if (!tx.hash) {
          continue;
        }
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt && receipt.contractAddress) {
          const contractAddress = receipt.contractAddress;
          const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
          try {
            const isERC721 = await contract.supportsInterface(ERC721_INTERFACE_ID);
            if (isERC721) {
              console.log(`ERC721 contract created: ${contractAddress}`);
            }
          } catch (error) {
            // console.error(`Contract ${contractAddress} is not ERC721 or does not implement supportsInterface.`);
          }
        }
      }
    }
    
    // minted tokens
    const filter = {
      fromBlock: blockNumber,
      toBlock: blockNumber,
      topics: [
        TRANSFER_EVENT_TOPIC,
        ethers.zeroPadValue(ZERO_ADDRESS, 32)
      ]
    };
    const logs = await provider.getLogs(filter);
    const iface = new ethers.Interface(ERC721_ABI);
    for (const log of logs) {
      if (log.topics.length !== 4) {
        // console.warn(`Skipping log from contract ${log.address} due to topics length ${log.topics.length}`);
        continue;
      }
      const parsedLog = iface.parseLog(log);
      const { from, to, tokenId } = parsedLog.args;
      if (from.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        console.log(`Minted token: Contract ${log.address} TokenID ${tokenId} to ${to}`);
      }
    }
  } catch (error) {
    console.error(`Error processing block ${blockNumber}:`, error);
  }
}

async function main() {
  console.log("Listening for new blocks...");
  provider.on("block", processBlock);
}

main();
