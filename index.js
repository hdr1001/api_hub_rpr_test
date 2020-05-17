// *********************************************************************
//
// API Hub v3 JavaScript test code
// JavaScript code file: index.js
//
// Copyright 2020 Hans de Rooij
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, 
// software distributed under the License is distributed on an 
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
// either express or implied. See the License for the specific 
// language governing permissions and limitations under the 
// License.
//
// *********************************************************************
'use strict';

const fs   = require('fs');
const http = require('http');

const RateLimiter = require('limiter').RateLimiter;
const limiter = new RateLimiter(5, 'second');

//Randomly change the sequence of array elements
function arrShuffle(arr) {
   let currIdx = arr.length;
   let tempVal, rndIdx;

   while (0 !== currIdx) {
      //Randomly pick an element with the same or other
      //index value as the current element
      rndIdx = Math.floor(Math.random() * currIdx--);
 
      //Swap the value if applicable
      if(rndIdx !== currIdx) {
         tempVal = arr[currIdx];
         arr[currIdx] = arr[rndIdx];
         arr[rndIdx] = tempVal;
      }
   }

   return arr;
}

//Randomly choose a D&B product
function getDnbProduct() {
   let rnd = Math.random();

   if(rnd < 0.20) {
      return 'cmptcs'
   }
   else if(rnd < 0.35) {
      return 'cmpcvf'
   }
   else if(rnd < 0.5) {
      return 'cmpbos'
   }
   else if(rnd < 0.65) {
      return 'CMP_VRF_ID'
   }
   else if(rnd < 0.80) {
      return 'CMP_BOS'
   }
   else if (rnd < 95) {
      return 'gdp_em'
   }
   else {
      return '';
   }
}

//Read & parse the example DUNS from the file
let arrDUNS = fs.readFileSync('DUNS.txt').toString().split('\n');
arrDUNS = arrDUNS.filter(sDUNS => !!sDUNS); //Remove empty values from the array
console.log('Test file contains ' + arrDUNS.length + ' DUNS records');

//Read & parse the example Legal Entity Identifiers
let arrLEI = fs.readFileSync('GLEIF.txt').toString().split('\n');
arrLEI = arrLEI.filter(sLEI => !!sLEI); //Remove empty values from the array
console.log('Test file contains ' + arrLEI.length + ' LEI records');

//Randomly shuffle the DUNS array in 2 new arrays
let arrCmpelk   = arrShuffle(arrDUNS.slice()); //slice method for the shallow copy
let arrOtherDnb = arrShuffle(arrDUNS.slice());

//Randomly shuffle the LEI array
arrShuffle(arrLEI);

//Declare the process array
const arrProc = [];

//Build the process array
for(let i = 0; i < arrDUNS.length; i++) {
   arrProc.push([
      {
         key: arrCmpelk[i],
         prod: 'cmpelk',
         forceNew: (Math.random() > 1)
      },
      {
         key: arrOtherDnb[i],
         prod: getDnbProduct(),
         forceNew: (Math.random() > 1)
      }
   ]);
}

//Add the LEI test cases to the process array
for(let i = 0; i < arrDUNS.length && i < arrLEI.length; i++) {
   arrProc[i].push(
      {
         key: arrLEI[i],
         prod: 'lei_ref',
         forceNew: (Math.random() > 0.8)
      }
   );
}

//The ID arrays can now be garbage collected
arrDUNS = arrCmpelk = arrOtherDnb = arrLEI = null;

const ahHttpAttr = {
   method: 'GET',
   host: '',
   port: '',
   path: ''
};

function getAhDataProduct(testCase) {
   let httpAttr = Object.assign({}, ahHttpAttr);
   httpAttr.path += '/' + testCase.prod + '/' + testCase.key;
   if(testCase.forceNew) {
      httpAttr.path += '?forceNew=true';
   }

   return new Promise((resolve, reject) => {
      http.get(httpAttr, resp => {
         let body = [];

         resp.on('data', chunk => body.push(chunk));

         resp.on('end', () => { //The data product is now available in full
            let ret = {
               status: resp.statusCode,
               headers: resp.headers,
               body: body.join('')
            };

            testCase.dataProduct = ret;

            resolve(ret);
         });

         resp.on('error', err => reject(err));
      });
   });
}

let getAhDataProductThrottled = testCase => {
   if(!testCase.prod || !testCase.key) {return null}

   limiter.removeTokens(1, () => {
      getAhDataProduct(testCase)
         .then(resp => {
            let sLog = 'API response: ';
            sLog += testCase.prod + '/' + testCase.key + ', ';
            sLog += resp.status + ', ' + resp.headers['x-api-hub-prod-db'] + ', ';
            sLog += (+new Date);

            console.log(sLog);
         })
         .catch(err => console.log(err));
   });
}

console.log('Start ' + (+new Date))
arrProc.forEach(row => {
   row.forEach(testCase => getAhDataProductThrottled(testCase));
});
/*
setTimeout(() => {
   let oProd = JSON.parse(arrProc[0][0].dataProduct.body);

   console.log('➡️ ' + oProd.organization.primaryName)},

   10000
);
*/
