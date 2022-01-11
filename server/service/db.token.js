require('dotenv').config();
const EnumChainId = require('../../enum/chain.id');
const EnumMainTokens = require('../../enum/mainTokens');
var TokenBasic = require('../models/token_basic');
var ServiceHistory = require('./db.history');

async function findByContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: contract.toLowerCase() }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos;
}
async function getSymbolFromContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: contract.toLowerCase() }).select({ symbol: 1 }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos.symbol;
}

async function getPairs( contract ){
    let tokenPairs = await ServiceHistory.findPairs( contract.toLowerCase() );
    let pairs = {} // tokenAddress => { reserve: num, name: name }
    for( let i in tokenPairs ){
        let pairInfos = tokenPairs[i];
        
        if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN ) pairs[pairInfos.pair] = {};
        else if( EnumMainTokens[pairInfos.chain].STABLECOINS.includes( pairInfos.mainToken ) ) pairs[pairInfos.pair] = {};
        
        if( i == tokenPairs.length - 1 && !Object.keys(pairs).length ){}
        else if( !pairs[pairInfos.pair] ) continue;

        pairs[pairInfos.pair] = { 
            mainToken: pairInfos.mainToken, 
            mainReserveValue: pairInfos.mainReserveValue,
            name: pairInfos.token0.name, 
            router: pairInfos.router,
            chain: pairInfos.chain
        };

        if( pairInfos.mainToken == pairInfos.token0.contract ) pairs[pairInfos.pair].reserve = pairInfos.reserve0; 
        else pairs[pairInfos.pair].reserve = pairInfos.reserve1;
        
    }
    return pairs;
}
async function getPairsMultiple( contracts ){
    for( let i in contracts ){
        contracts[i] = contracts[i].toLowerCase();
    }

    let tokensPairs = await ServiceHistory.findPairsMultiple( contracts );
    let pairsRetrived = {} // tokenAddress: { pairAddress => { reserve: num, name: name } }
    for( let pairRetrived of tokensPairs ){
        if(!pairsRetrived[pairRetrived.dependantToken]) pairsRetrived[pairRetrived.dependantToken] = [];
        pairsRetrived[pairRetrived.dependantToken].push(pairRetrived);
    }
    let organizedPairs = {};
    for( let token in pairsRetrived ){
        let pairsToCheck = pairsRetrived[token];
        organizedPairs[token] = {};
        for( let i in pairsToCheck ){
            let pairInfos = pairsToCheck[i];
            
            if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN ) organizedPairs[token][pairInfos.pair] = {};
            else if( EnumMainTokens[pairInfos.chain].STABLECOINS.includes( pairInfos.mainToken ) ) organizedPairs[token][pairInfos.pair] = {};
    
            if( i == pairsToCheck.length - 1 && !Object.keys(organizedPairs[token]).length ){}
            else if( !organizedPairs[token][pairInfos.pair] ) continue;
    
            organizedPairs[token][pairInfos.pair] = { 
                mainToken: pairInfos.mainToken, 
                mainReserveValue: pairInfos.mainReserveValue,
                name: pairInfos.token0.name, 
                router: pairInfos.router,
                chain: pairInfos.chain
            };
    
            if( pairInfos.mainToken == pairInfos.token0.contract ) organizedPairs[token][pairInfos.pair].reserve = pairInfos.reserve0; 
            else organizedPairs[token][pairInfos.pair].reserve = pairInfos.reserve1;
        }
    }
    
    return organizedPairs;
}

async function getMainPair( contract ){

    let pairs = await getPairs( contract.toLowerCase() ) // tokenAddress => pair informations

    let mainPair = null; // each token probably has a pair with bnb or main stable coins, and we prefer that ones
    let mainPairVal = 0;

    for( let pair in pairs ){
        let pairInfos = pairs[pair];
        
        if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN ) {
            if( pairInfos.mainReserveValue > mainPairVal ){
                mainPair = pair;
                mainPairVal = pairInfos.mainReserveValue;
            }
        }
        else if( EnumMainTokens[pairInfos.chain].STABLECOINS.includes( pairInfos.mainToken ) ) {
            if( pairInfos.mainReserveValue > mainPairVal ) {
                mainPair = pair;
                mainPairVal = pairInfos.mainReserveValue;
            }
        }
    }

    if( !mainPair ) return Object.keys( pairs )[0]; // if no mainPair was found, return the first pair inside the object
    else return mainPair;
}
async function getMainPairMultiple( contracts ){

    for( let i in contracts ){
        contracts[i] = contracts[i].toLowerCase();
    }

    let tokensPairs = await getPairsMultiple( contracts ) // tokenAddress => { pair address: pair informations }

    let mainPairs = {};
    for( let token in tokensPairs ){
        let pairs = tokensPairs[token];
        mainPairs[token] = { mainPair: null, mainPairVal: 0 }
        for( let pair in pairs ){
            let pairInfos = pairs[pair];
            if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN ) {
                if( pairInfos.mainReserveValue >  mainPairs[token].mainPairVal ){
                    mainPairs[token].mainPair = pair;
                    mainPairs[token].mainPairVal = pairInfos.mainReserveValue;
                }
            }
            else if( EnumMainTokens[pairInfos.chain].STABLECOINS.includes( pairInfos.mainToken ) ) {
                if( pairInfos.mainReserveValue >  mainPairs[token].mainPairVal ) {
                    mainPairs[token].mainPair = pair;
                    mainPairs[token].mainPairVal = pairInfos.mainReserveValue;
                }
            }
        }
        if( !mainPairs[token] ) mainPairs[token].mainPair = Object.keys( pairs )[0]; // if no mainPair was found, return the first pair inside the token pairs
    }
    return mainPairs;
}
module.exports = {
    findByContract,
    getSymbolFromContract,
    getMainPair,
    getMainPairMultiple,
    getPairs
}