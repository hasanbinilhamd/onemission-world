import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

const DATE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'launchNotifiedAt',
]);

const SNAPSHOT = {
  "generatedAt": "2026-08-14T09:04:48.914Z",
  "models": {
    "Product": [
      {
        "id": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "name": "UDEL OFF LEGGING",
        "sku": "UO-OM",
        "category": "Compression Pants",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 79350,
        "sellingPrice": 189000,
        "description": "Recovery-focused performance legging designed with a relaxed compression feel to support muscle relaxation, comfort, and post-training recovery and cover Navel",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "L",
          "3XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/3.png?updatedAt=1786413568565",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/8.png?updatedAt=1786434864615"
      },
      {
        "id": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "name": "Coreflex Sport Shirt",
        "sku": "CSS-OM",
        "category": "Compression Shirts",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 74750,
        "sellingPrice": 149000,
        "description": "",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "M",
          "L",
          "XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/4.png?updatedAt=1786413568568",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/1_Um9dQAB5v.png?updatedAt=1786432634557"
      },
      {
        "id": "375c0877-d96d-495c-9162-dd32cce343fc",
        "name": "COWBOY RUNNING CAP",
        "sku": "CR-OM",
        "category": "Accessories",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 51750,
        "sellingPrice": 119000,
        "description": "Ultra-lightweight running cap designed for maximum breathability, sun protection, and all-day comfort during training and outdoor activities.",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "AllSize"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/7.png?updatedAt=1786413568590",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/2.png?updatedAt=1786434864957"
      },
      {
        "id": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "name": "BASIC LONG LEGGING",
        "sku": "BL-OM",
        "category": "Compression Pants",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 35750,
        "sellingPrice": 99000,
        "description": "Full-length performance legging designed to provide complete lower-body coverage, lasting comfort, and reliable support for every training session.",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "XL",
          "3XL",
          "5XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/5.png?updatedAt=1786413568559",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/basic%20long.png?updatedAt=1786434939368"
      },
      {
        "id": "8e46a914-e6df-497e-839e-773c56712f90",
        "name": "FLEX POCKET LEGGING",
        "sku": "OM-FP",
        "category": "Compression Pants",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 62600,
        "sellingPrice": 169000,
        "description": "Engineered with performance compression and secure side pockets, allowing Muslim athletes to train freely without sacrificing functionality or values.",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "L",
          "2XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/8.png?updatedAt=1786413568573",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/flex.png?updatedAt=1786434951851"
      },
      {
        "id": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "name": "PRO SPORT LEGGING",
        "sku": "PS-OM",
        "category": "Compression Pants",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 76600,
        "sellingPrice": 199000,
        "description": "High-performance compression legging engineered for serious athletes, delivering enhanced muscle support, stability, and endurance during intense training sessions.",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "L",
          "2XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/2.png?updatedAt=1786413568566",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/6.png?updatedAt=1786434864461"
      },
      {
        "id": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "name": "Awrah Fit Ultra Stretch",
        "sku": "AWRF-OM",
        "category": "Accessories",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 46000,
        "sellingPrice": 95500,
        "description": "soon",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "L",
          "M",
          "XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/6.png?updatedAt=1786413568569",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/awrah%20fit.png?updatedAt=1786434883974"
      },
      {
        "id": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "name": "BASIC 3/4 LEGGING",
        "sku": "B3/4-OM",
        "category": "Compression Pants",
        "brand": "onemission",
        "status": "Active",
        "costPrice": 34800,
        "sellingPrice": 89000,
        "description": "Essential 3/4 performance legging designed to deliver lightweight muscle support, unrestricted movement, and comfortable coverage for everyday training.",
        "materials": "",
        "careInstructions": "",
        "shippingInformation": "",
        "sizeGuideImageUrl": "",
        "tags": [],
        "colors": [
          "Black"
        ],
        "sizes": [
          "XL",
          "3XL",
          "5XL"
        ],
        "notes": "",
        "imageUrl": "https://ik.imagekit.io/qqulvbiww/Products/PRODUCT%20ONLY/1.png?updatedAt=1786413568580",
        "hoverImageUrl": "https://ik.imagekit.io/qqulvbiww/Products/hoover%20all%20product/3_4%20legging.png?updatedAt=1786434897900"
      }
    ],
    "ProductGallery": [
      {
        "id": "gallery-1786158470080-k5gkhpjq",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/4.png?updatedAt=1786336256149",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T07:50:27.073Z",
        "updatedAt": "2026-08-14T07:50:27.073Z"
      },
      {
        "id": "gallery-1786158480308-yqi6js6s",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/5.png?updatedAt=1786336256056",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T07:50:27.073Z",
        "updatedAt": "2026-08-14T07:50:27.073Z"
      },
      {
        "id": "gallery-1786158511821-j17qfu5i",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/6.png?updatedAt=1786336256268",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T07:50:27.073Z",
        "updatedAt": "2026-08-14T07:50:27.073Z"
      },
      {
        "id": "gallery-1786158529399-5rn4b17s",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/1.png?updatedAt=1786336256297",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T07:50:27.073Z",
        "updatedAt": "2026-08-14T07:50:27.073Z"
      },
      {
        "id": "gallery-1786158571862-ln3i5d80",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/3.png?updatedAt=1786336255675",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-14T07:50:27.073Z",
        "updatedAt": "2026-08-14T07:50:27.073Z"
      },
      {
        "id": "gallery-1786176172931-uaclxt77",
        "productId": "375c0877-d96d-495c-9162-dd32cce343fc",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Cowboy%20Running%20Cap/5.png?updatedAt=1786175660951",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-13T23:42:41.235Z",
        "updatedAt": "2026-08-13T23:42:41.235Z"
      },
      {
        "id": "gallery-1786176180392-zfnyek52",
        "productId": "375c0877-d96d-495c-9162-dd32cce343fc",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Cowboy%20Running%20Cap/6.png?updatedAt=1786175660961",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-13T23:42:41.235Z",
        "updatedAt": "2026-08-13T23:42:41.235Z"
      },
      {
        "id": "gallery-1786176211589-if0hhmei",
        "productId": "375c0877-d96d-495c-9162-dd32cce343fc",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Cowboy%20Running%20Cap/2.png?updatedAt=1786175660156",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-13T23:42:41.235Z",
        "updatedAt": "2026-08-13T23:42:41.235Z"
      },
      {
        "id": "gallery-1786343526184-scspmun1",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/6.png?updatedAt=1786343034560",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T04:01:58.443Z",
        "updatedAt": "2026-08-14T04:01:58.443Z"
      },
      {
        "id": "gallery-1786343543067-uhpwke0s",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/5.png?updatedAt=1786343034164",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T04:01:58.443Z",
        "updatedAt": "2026-08-14T04:01:58.443Z"
      },
      {
        "id": "gallery-1786343576798-5wwm077k",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/1.png?updatedAt=1786343034091",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T04:01:58.443Z",
        "updatedAt": "2026-08-14T04:01:58.443Z"
      },
      {
        "id": "gallery-1786343587396-d1x7sdu8",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/2.png?updatedAt=1786343034615",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T04:01:58.443Z",
        "updatedAt": "2026-08-14T04:01:58.443Z"
      },
      {
        "id": "gallery-1786343592840-exdtt5px",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/3.png?updatedAt=1786343033990",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-14T04:01:58.443Z",
        "updatedAt": "2026-08-14T04:01:58.443Z"
      },
      {
        "id": "gallery-1786408735852-pp61ulo1",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/1.png?updatedAt=1786403817353",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786408775571-qlxujlcm",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/6.png?updatedAt=1786403817735",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786408808610-ifh521sp",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/7.png?updatedAt=1786403817887",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786408818352-68wf7m4l",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/4.png?updatedAt=1786403816827",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786408836288-ijubybop",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/2.png?updatedAt=1786403816831",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786408845782-ak8w1a2n",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/3.png?updatedAt=1786403816822",
        "mediaType": "IMAGE",
        "sortOrder": 6,
        "createdAt": "2026-08-14T06:00:52.280Z",
        "updatedAt": "2026-08-14T06:00:52.280Z"
      },
      {
        "id": "gallery-1786440405656-ycgs4b4c",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/9.png?updatedAt=1786440344885",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440534736-w3j5mlsl",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/6.png?updatedAt=1786440343825",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440537609-prlhaahp",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/7.png?updatedAt=1786440345021",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440562070-ct0usrcm",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/5.png?updatedAt=1786440344975",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440590158-7hr59rmr",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/10.png?updatedAt=1786440345135",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440608551-nuaccs3x",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/2.png?updatedAt=1786440343315",
        "mediaType": "IMAGE",
        "sortOrder": 6,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440615955-a71qkzzz",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/4.png?updatedAt=1786440344878",
        "mediaType": "IMAGE",
        "sortOrder": 7,
        "createdAt": "2026-08-11T09:30:24.011Z",
        "updatedAt": "2026-08-11T09:30:24.011Z"
      },
      {
        "id": "gallery-1786440674641-7r36gef0",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/2.png?updatedAt=1786440312020",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440686003-d5ahm3rn",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/1.png?updatedAt=1786440312557",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440704180-xvx4eatj",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/3.png?updatedAt=1786440312576",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440712834-1rvwyhbk",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/7.png?updatedAt=1786440313020",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440722501-qmn7ufsz",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/6.png?updatedAt=1786440311917",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440733872-xsokcpd1",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/3-4%20Basic%20Legging/6.png?updatedAt=1786440311917",
        "mediaType": "IMAGE",
        "sortOrder": 6,
        "createdAt": "2026-08-14T04:04:43.719Z",
        "updatedAt": "2026-08-14T04:04:43.719Z"
      },
      {
        "id": "gallery-1786440826699-dlfbo4o2",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/9.png?updatedAt=1786440291051",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T04:06:00.342Z",
        "updatedAt": "2026-08-14T04:06:00.342Z"
      },
      {
        "id": "gallery-1786440837984-75mpaum4",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/5.png?updatedAt=1786440290775",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T04:06:00.342Z",
        "updatedAt": "2026-08-14T04:06:00.342Z"
      },
      {
        "id": "gallery-1786440860209-6qrbnsx3",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/3.png?updatedAt=1786440290596",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T04:06:00.342Z",
        "updatedAt": "2026-08-14T04:06:00.342Z"
      },
      {
        "id": "gallery-1786440887737-nhfv4kv5",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/4.png?updatedAt=1786440290517",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T04:06:00.342Z",
        "updatedAt": "2026-08-14T04:06:00.342Z"
      },
      {
        "id": "gallery-1786440898595-992ztyqd",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/2.png?updatedAt=1786440290629",
        "mediaType": "IMAGE",
        "sortOrder": 5,
        "createdAt": "2026-08-14T04:06:00.342Z",
        "updatedAt": "2026-08-14T04:06:00.342Z"
      },
      {
        "id": "gallery-1786440966745-w0cmuds5",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/2.png?updatedAt=1786411192417",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "createdAt": "2026-08-14T04:05:19.461Z",
        "updatedAt": "2026-08-14T04:05:19.461Z"
      },
      {
        "id": "gallery-1786441010622-ypiibfy0",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/7.png?updatedAt=1786411192514",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "createdAt": "2026-08-14T04:05:19.461Z",
        "updatedAt": "2026-08-14T04:05:19.461Z"
      },
      {
        "id": "gallery-1786441060554-hx5fyzwf",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/4.png?updatedAt=1786411192112",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "createdAt": "2026-08-14T04:05:19.461Z",
        "updatedAt": "2026-08-14T04:05:19.461Z"
      },
      {
        "id": "gallery-1786441073540-m04s56s0",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/6.png?updatedAt=1786411192621",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "createdAt": "2026-08-14T04:05:19.461Z",
        "updatedAt": "2026-08-14T04:05:19.461Z"
      }
    ],
    "ProductShowcase": [
      {
        "id": "showcase-1786333478690-rgobqi2z",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/foto%20deskripsi/21.png2?updatedAt=1786693695298",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T07:50:27.083Z",
        "updatedAt": "2026-08-14T07:50:27.083Z"
      },
      {
        "id": "showcase-1786333487216-0d3cuhr6",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/foto%20deskripsi/22.png2?updatedAt=1786693695704",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T07:50:27.083Z",
        "updatedAt": "2026-08-14T07:50:27.083Z"
      },
      {
        "id": "showcase-1786333500761-vqt6xzmj",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/foto%20deskripsi/24.png2?updatedAt=1786693695401",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T07:50:27.083Z",
        "updatedAt": "2026-08-14T07:50:27.083Z"
      },
      {
        "id": "showcase-1786333506729-0hq2z40z",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/foto%20deskripsi/24.png2?updatedAt=1786693695401",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "isActive": true,
        "createdAt": "2026-08-14T07:50:27.083Z",
        "updatedAt": "2026-08-14T07:50:27.083Z"
      },
      {
        "id": "showcase-1786592481413-szjurhx2",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/9.png?updatedAt=1786668775202",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T04:05:19.464Z",
        "updatedAt": "2026-08-14T04:05:19.464Z"
      },
      {
        "id": "showcase-1786592497626-j5hqhim9",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/10.png?updatedAt=1786668775321",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T04:05:19.464Z",
        "updatedAt": "2026-08-14T04:05:19.464Z"
      },
      {
        "id": "showcase-1786592509299-kf1qg6ws",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/8.png?updatedAt=1786668775280",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T04:05:19.464Z",
        "updatedAt": "2026-08-14T04:05:19.464Z"
      },
      {
        "id": "showcase-1786680067431-epe86xgx",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/DETAIL/13.png?updatedAt=1786677662630",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T04:01:58.459Z",
        "updatedAt": "2026-08-14T04:01:58.459Z"
      },
      {
        "id": "showcase-1786680093364-o8oyp17t",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/DETAIL/11.png?updatedAt=1786677662672",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T04:01:58.459Z",
        "updatedAt": "2026-08-14T04:01:58.459Z"
      },
      {
        "id": "showcase-1786680101804-qmhu8jdn",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/DETAIL/12.png?updatedAt=1786677662645",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T04:01:58.459Z",
        "updatedAt": "2026-08-14T04:01:58.459Z"
      },
      {
        "id": "showcase-1786680112752-vy1r24pu",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/DETAIL/14.png?updatedAt=1786677662512",
        "mediaType": "IMAGE",
        "sortOrder": 4,
        "isActive": true,
        "createdAt": "2026-08-14T04:01:58.459Z",
        "updatedAt": "2026-08-14T04:01:58.459Z"
      },
      {
        "id": "showcase-1786680137733-5i1vca64",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/DETAIL/12.png?updatedAt=1786678860896",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T06:00:52.288Z",
        "updatedAt": "2026-08-14T06:00:52.288Z"
      },
      {
        "id": "showcase-1786680172813-a2ihlxr4",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/DETAIL/10.png?updatedAt=1786678861202",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T06:00:52.288Z",
        "updatedAt": "2026-08-14T06:00:52.288Z"
      },
      {
        "id": "showcase-1786680183691-agaycl35",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Flex%20Pocket/DETAIL/11.png?updatedAt=1786678860869",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T06:00:52.288Z",
        "updatedAt": "2026-08-14T06:00:52.288Z"
      },
      {
        "id": "showcase-1786680268463-37dndw9p",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/9.png?updatedAt=1786668775202",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T04:04:43.720Z",
        "updatedAt": "2026-08-14T04:04:43.720Z"
      },
      {
        "id": "showcase-1786680271121-ogayv8n7",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/10.png?updatedAt=1786668775321",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T04:04:43.720Z",
        "updatedAt": "2026-08-14T04:04:43.720Z"
      },
      {
        "id": "showcase-1786680277549-b6k8sqb1",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Basic%20Legging/DETAIL%20INFORMATION/8.png?updatedAt=1786668775280",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T04:04:43.720Z",
        "updatedAt": "2026-08-14T04:04:43.720Z"
      },
      {
        "id": "showcase-1786680343050-77ud9e5a",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/DETAIL/10.png?updatedAt=1786678813712",
        "mediaType": "IMAGE",
        "sortOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-14T04:06:00.345Z",
        "updatedAt": "2026-08-14T04:06:00.345Z"
      },
      {
        "id": "showcase-1786680345355-vghg8ak8",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/DETAIL/11.png?updatedAt=1786678814493",
        "mediaType": "IMAGE",
        "sortOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-14T04:06:00.345Z",
        "updatedAt": "2026-08-14T04:06:00.345Z"
      },
      {
        "id": "showcase-1786680352111-j6jcht7t",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/DETAIL/12.png?updatedAt=1786678814132",
        "mediaType": "IMAGE",
        "sortOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-14T04:06:00.345Z",
        "updatedAt": "2026-08-14T04:06:00.345Z"
      }
    ],
    "Inventory": [
      {
        "id": "04710083-bf8f-436c-b078-ada042493e06",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "color": "Black",
        "size": "L",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "1575c91b-7ac3-4279-be86-49e0c177a926",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "color": "Black",
        "size": "XL",
        "quantity": 2,
        "realStock": 2,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "7b49e0fd-014b-46a2-8a87-96f0e61b857f",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "color": "Black",
        "size": "M",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a1f9c1f5-0001-4001-8001-10ed5840d001",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "color": "Black",
        "size": "L",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a1f9c1f5-0001-4001-8001-10ed5840d002",
        "productId": "05f9c1f5-fdbd-4d9a-9a46-10ed5840d612",
        "color": "Black",
        "size": "3XL",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a2c0877d-0002-4002-8002-dd32cce34001",
        "productId": "375c0877-d96d-495c-9162-dd32cce343fc",
        "color": "Black",
        "size": "AllSize",
        "quantity": 25,
        "realStock": 25,
        "websiteStock": 25,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a3e5b24d-0003-4003-8003-dcad32fda001",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "color": "Black",
        "size": "XL",
        "quantity": 14,
        "realStock": 14,
        "websiteStock": 14,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a3e5b24d-0003-4003-8003-dcad32fda002",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "color": "Black",
        "size": "3XL",
        "quantity": 42,
        "realStock": 42,
        "websiteStock": 37,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a3e5b24d-0003-4003-8003-dcad32fda003",
        "productId": "812e5b24-d521-4c89-a9d9-dcad32fda52d",
        "color": "Black",
        "size": "5XL",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a4e6a914-0004-4004-8004-773c56712f01",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "color": "Black",
        "size": "L",
        "quantity": 12,
        "realStock": 12,
        "websiteStock": 12,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a4e6a914-0004-4004-8004-773c56712f02",
        "productId": "8e46a914-e6df-497e-839e-773c56712f90",
        "color": "Black",
        "size": "2XL",
        "quantity": 26,
        "realStock": 26,
        "websiteStock": 24,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a5f404d7-0005-4005-8005-72cd49700a01",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "color": "Black",
        "size": "L",
        "quantity": 12,
        "realStock": 12,
        "websiteStock": 12,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a5f404d7-0005-4005-8005-72cd49700a02",
        "productId": "d733f404-54e9-444d-b4c7-72cd49700ac3",
        "color": "Black",
        "size": "2XL",
        "quantity": 29,
        "realStock": 29,
        "websiteStock": 29,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a6f0ae0f-0006-4006-8006-a8370e894001",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "color": "Black",
        "size": "XL",
        "quantity": 7,
        "realStock": 7,
        "websiteStock": 7,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a6f0ae0f-0006-4006-8006-a8370e894002",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "color": "Black",
        "size": "3XL",
        "quantity": 23,
        "realStock": 23,
        "websiteStock": 10,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "a6f0ae0f-0006-4006-8006-a8370e894003",
        "productId": "f64f0ae0-5df3-42fa-8df9-a8370e894123",
        "color": "Black",
        "size": "5XL",
        "quantity": 1,
        "realStock": 1,
        "websiteStock": 1,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "e4ed1302-cbf7-4773-ba1a-c3d3e93c55a9",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "color": "Black",
        "size": "M",
        "quantity": 2,
        "realStock": 2,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "eafb230d-0499-48fc-aba4-0e2ddd98a921",
        "productId": "dc48fa46-ac0d-4dae-8ee4-34fa9c463e4f",
        "color": "Black",
        "size": "L",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      },
      {
        "id": "fbd84789-6670-4164-ab91-0fbc641ae1b8",
        "productId": "2ff62213-9d82-484b-95e3-cdcbbb8f5834",
        "color": "Black",
        "size": "XL",
        "quantity": 0,
        "realStock": 0,
        "websiteStock": 0,
        "averageCost": 0,
        "threshold": 5,
        "incoming": 0,
        "status": "Active"
      }
    ],
    "WebsiteHero": [
      {
        "id": "108a229e-6830-4781-a946-749d51d07395",
        "mediaType": "IMAGE",
        "desktopUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/josssc.png?updatedAt=1785984270476",
        "mobileUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/josssc.png?updatedAt=1785984270476",
        "displayOrder": 2,
        "isActive": true,
        "scale": 1,
        "verticalOffset": 0,
        "createdAt": "2026-08-13T07:52:35.081Z",
        "updatedAt": "2026-08-13T07:52:35.081Z"
      },
      {
        "id": "3e88ec6a-cab7-4618-8cd5-ccd3daacb7e8",
        "mediaType": "IMAGE",
        "desktopUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/okokosss.png?updatedAt=1785984803317",
        "mobileUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/okokosss.png?updatedAt=1785984803317",
        "displayOrder": 4,
        "isActive": true,
        "scale": 1,
        "verticalOffset": 0,
        "createdAt": "2026-08-13T07:52:35.081Z",
        "updatedAt": "2026-08-13T07:52:35.081Z"
      },
      {
        "id": "92599f3d-4531-4adf-a375-44857ce5a21c",
        "mediaType": "IMAGE",
        "desktopUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/4.png?updatedAt=1785992669409",
        "mobileUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/4.png?updatedAt=1785992669409",
        "displayOrder": 1,
        "isActive": true,
        "scale": 1,
        "verticalOffset": 0,
        "createdAt": "2026-08-13T07:52:35.081Z",
        "updatedAt": "2026-08-13T07:52:35.081Z"
      },
      {
        "id": "a7f50ce2-1851-432c-a2d4-ee2691c5fccd",
        "mediaType": "IMAGE",
        "desktopUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/cowboyyy%20website.png?updatedAt=1785998570232",
        "mobileUrl": "https://ik.imagekit.io/qqulvbiww/Homepage/Hero%20Carousel/cowboyyy%20website.png?updatedAt=1785998570232",
        "displayOrder": 3,
        "isActive": true,
        "scale": 1,
        "verticalOffset": 0,
        "createdAt": "2026-08-13T07:52:35.081Z",
        "updatedAt": "2026-08-13T07:52:35.081Z"
      }
    ],
    "WebsiteCollectionHero": [
      {
        "id": "e6ad23e2-011b-4b86-8778-3e42438153a7",
        "heroType": "IMAGE",
        "title": "Muslim On A Mission.",
        "description": "Bring Back The Value through apparel designed with purpose. The ONEMISSION Collection blends performance, comfort, and modest design into everyday essentials made for movement, discipline, and intentional living.",
        "overlayOpacity": 35,
        "isActive": true,
        "createdAt": "2026-08-08T02:03:13.115Z",
        "updatedAt": "2026-08-08T02:03:13.115Z"
      }
    ],
    "WebsiteCollectionHeroMedia": [
      {
        "id": "1e509683-3e98-4cf3-856f-2491c14ae196",
        "heroId": "e6ad23e2-011b-4b86-8778-3e42438153a7",
        "mediaType": "IMAGE",
        "desktopUrl": "https://ik.imagekit.io/qqulvbiww/Collection/AWRAAHSSS.png?updatedAt=1786002010079",
        "mobileUrl": "https://ik.imagekit.io/qqulvbiww/Collection/BRINGBACKTHEVALUE.png?updatedAt=1786002410007",
        "displayOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-08T02:03:13.115Z",
        "updatedAt": "2026-08-08T02:03:13.115Z"
      }
    ],
    "WebsiteProductStory": [
      {
        "id": "7ef798e6-a9ed-4553-80e6-497e83d798ce",
        "mediaType": "IMAGE",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/7.png?updatedAt=1786411266413",
        "description": "Performance silhouettes shaped to move freely while keeping a clean, confident presence in every setting.",
        "displayOrder": 1,
        "isActive": true,
        "createdAt": "2026-08-12T03:24:46.903Z",
        "updatedAt": "2026-08-12T03:24:46.903Z"
      },
      {
        "id": "8b7200cb-2f71-4e6d-886e-286073641124",
        "mediaType": "IMAGE",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/7.png?updatedAt=1786411154528",
        "description": "A quiet visual story of pace, discipline, and intention expressed through motion-driven product presentation.",
        "displayOrder": 3,
        "isActive": true,
        "createdAt": "2026-08-12T03:24:46.903Z",
        "updatedAt": "2026-08-12T03:24:46.903Z"
      },
      {
        "id": "92d578c7-13ad-4887-af9c-fa64446a061b",
        "mediaType": "IMAGE",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/10.png?updatedAt=1786440345135",
        "description": "Every visual cue is meant to feel purposeful, understated, and ready for a global Muslim lifestyle.",
        "displayOrder": 4,
        "isActive": true,
        "createdAt": "2026-08-12T03:24:46.903Z",
        "updatedAt": "2026-08-12T03:24:46.903Z"
      },
      {
        "id": "9cf7aa6d-5276-4691-960a-03f925071c15",
        "mediaType": "IMAGE",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/5.png?updatedAt=1786440344975",
        "description": "Soft structure, elevated finishes, and durable comfort create a premium layer that holds up from commute to workout.",
        "displayOrder": 2,
        "isActive": true,
        "createdAt": "2026-08-12T03:24:46.903Z",
        "updatedAt": "2026-08-12T03:24:46.903Z"
      },
      {
        "id": "temp-product-story-1786505074798-glnhbp",
        "mediaType": "IMAGE",
        "mediaUrl": "https://ik.imagekit.io/qqulvbiww/Products/Udel%20Off/9.png?updatedAt=1786440291051",
        "description": "Every visual cue is meant to feel purposeful, understated, and ready for a global Muslim lifestyle.",
        "displayOrder": 5,
        "isActive": true,
        "createdAt": "2026-08-12T03:24:46.903Z",
        "updatedAt": "2026-08-12T03:24:46.903Z"
      }
    ],
    "Faq": [
      {
        "id": "06f54b40-460c-40fc-a0ea-f35ab4cbf38a",
        "question": "Metode pembayaran apa saja yang tersedia?",
        "answer": "Metode pembayaran yang tersedia akan ditampilkan pada halaman checkout. Pilihan pembayaran dapat berbeda sesuai konfigurasi dan ketersediaan layanan pada saat melakukan pemesanan.",
        "category": "Payment",
        "sortOrder": 5,
        "isPublished": true,
        "createdAt": "2026-08-13T04:01:57.148Z",
        "updatedAt": "2026-08-13T04:01:57.148Z"
      },
      {
        "id": "1e9e1af5-a92b-461c-bdd7-44759c38e960",
        "question": "Apakah produk yang sudah dibeli dapat ditukar atau diretur?",
        "answer": "Produk dapat diajukan untuk return sesuai dengan kebijakan return OneMission dan kondisi yang berlaku. Setelah order diterima, customer dapat mengajukan return melalui sistem jika memenuhi ketentuan. Untuk replacement, ukuran atau varian tertentu dapat ditukar sesuai ketentuan yang berlaku pada produk dan ketersediaan stok.",
        "category": "Order",
        "sortOrder": 7,
        "isPublished": true,
        "createdAt": "2026-08-13T04:03:37.898Z",
        "updatedAt": "2026-08-13T04:03:37.898Z"
      },
      {
        "id": "5b235195-bacb-4d03-820f-558fcfe24599",
        "question": "Bagaimana jika produk yang saya terima rusak atau tidak sesuai pesanan?",
        "answer": "Segera ajukan return melalui sistem OneMission dan jelaskan kendala yang terjadi. Jika diperlukan, sertakan foto atau bukti kondisi produk. Tim OneMission akan melakukan pemeriksaan dan menentukan penyelesaian sesuai kondisi kasus dan kebijakan return yang berlaku.",
        "category": "Order",
        "sortOrder": 8,
        "isPublished": true,
        "createdAt": "2026-08-13T04:04:13.114Z",
        "updatedAt": "2026-08-13T04:04:13.114Z"
      },
      {
        "id": "6b185f89-c9ac-4906-ab8c-b77a7394ba7e",
        "question": "Bagaimana cara mengetahui status pesanan saya?",
        "answer": "Setelah melakukan pemesanan, kamu dapat melihat status order melalui akun OneMission. Status pesanan akan diperbarui sesuai proses pemenuhan order, mulai dari diproses hingga dikirim dan diterima.",
        "category": "Order",
        "sortOrder": 6,
        "isPublished": true,
        "createdAt": "2026-08-13T04:02:28.982Z",
        "updatedAt": "2026-08-13T04:02:28.982Z"
      },
      {
        "id": "91645523-a98e-4c32-b7e8-4460d0e3c046",
        "question": "Bagaimana cara melakukan pemesanan di OneMission?",
        "answer": "Pilih produk dan varian yang diinginkan, tambahkan ke keranjang, kemudian lanjutkan ke checkout. Isi informasi pengiriman, pilih metode pembayaran, lalu selesaikan pembayaran sesuai instruksi yang tersedia.",
        "category": "Order",
        "sortOrder": 4,
        "isPublished": true,
        "createdAt": "2026-08-13T04:01:26.086Z",
        "updatedAt": "2026-08-13T04:01:26.086Z"
      },
      {
        "id": "bd98d677-af7b-479b-84d7-59cb10cd51c8",
        "question": "Apa itu OneMission?",
        "answer": "OneMission adalah apparel yang dirancang untuk menemani aktivitas olahraga dan keseharian dengan mengutamakan kenyamanan, fungsi, dan desain yang tetap memperhatikan nilai modesty.",
        "category": "Onemission DNA",
        "sortOrder": 1,
        "isPublished": true,
        "createdAt": "2026-08-13T03:59:29.708Z",
        "updatedAt": "2026-08-13T03:59:29.708Z"
      },
      {
        "id": "da97ba7e-353e-48c4-ab91-10a8ad2a9e17",
        "question": "Bagaimana cara memilih ukuran yang tepat?",
        "answer": "Pilih ukuran berdasarkan size chart yang tersedia pada halaman produk. Kami menyarankan untuk mengukur ukuran tubuh atau membandingkannya dengan pakaian yang biasa digunakan sebelum menentukan size. Jika berada di antara dua ukuran, pertimbangkan preferensi fit yang diinginkan.",
        "category": "Onemission DNA",
        "sortOrder": 3,
        "isPublished": true,
        "createdAt": "2026-08-13T04:00:45.727Z",
        "updatedAt": "2026-08-13T04:00:45.727Z"
      },
      {
        "id": "ee8cd501-527b-44e4-b97c-42feed7fe29f",
        "question": "Produk apa saja yang tersedia di OneMission?",
        "answer": "OneMission menyediakan berbagai apparel olahraga dan produk pendukung aktivitas yang nyaman digunakan untuk latihan, running, maupun aktivitas sehari-hari. Ketersediaan produk dan varian dapat berbeda-beda sesuai stok yang tersedia di website.",
        "category": "Onemission DNA",
        "sortOrder": 2,
        "isPublished": true,
        "createdAt": "2026-08-13T04:00:03.641Z",
        "updatedAt": "2026-08-13T04:00:09.281Z"
      }
    ],
    "LaunchSubscriber": [
      {
        "id": "04c951bd-3e02-46e9-a8b4-a884686bcb0c",
        "code": "OMS-LS-AB4526",
        "phone": "6287768876812",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T10:51:32.685Z",
        "updatedAt": "2026-08-11T10:51:32.685Z",
        "deletedAt": null
      },
      {
        "id": "0af0249c-7e7f-42d1-863d-c26e1c640c23",
        "code": "OMS-LS-F3DF4A",
        "phone": "6285156475748",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T09:46:30.288Z",
        "updatedAt": "2026-08-13T09:46:30.288Z",
        "deletedAt": null
      },
      {
        "id": "0bb01b3e-ba6a-4abe-b565-27c54f6cbea5",
        "code": "OMS-LS-60B1D1",
        "phone": "6285208926669",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:40:52.832Z",
        "updatedAt": "2026-08-13T14:40:52.832Z",
        "deletedAt": null
      },
      {
        "id": "0cf16706-3d3b-4409-9711-9eb925711314",
        "code": "OMS-LS-E11BA1",
        "phone": "6282333038097",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-07T08:16:23.751Z",
        "updatedAt": "2026-08-07T08:16:23.751Z",
        "deletedAt": null
      },
      {
        "id": "1081caad-5bbd-4f70-8118-15b6c26e47bd",
        "code": "OMS-LS-FDE6BF",
        "phone": "6281288700313",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T07:29:30.498Z",
        "updatedAt": "2026-08-14T07:29:30.498Z",
        "deletedAt": null
      },
      {
        "id": "149cd164-acb3-4bf1-a014-24bf99d4ae3b",
        "code": "OMS-LS-769662",
        "phone": "6289650664729",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-12T15:35:22.937Z",
        "updatedAt": "2026-08-12T15:35:22.937Z",
        "deletedAt": null
      },
      {
        "id": "14c886fd-4033-4497-8238-a06ddb7dde67",
        "code": "OMS-LS-6141BD",
        "phone": "6287773903792",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T15:53:00.939Z",
        "updatedAt": "2026-08-13T15:53:00.939Z",
        "deletedAt": null
      },
      {
        "id": "15cbde95-7d42-4cbd-8d55-4c69dc046225",
        "code": "OMS-LS-801F5C",
        "phone": "6282246654398",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T09:18:26.706Z",
        "updatedAt": "2026-08-13T09:18:26.706Z",
        "deletedAt": null
      },
      {
        "id": "1b40e629-5576-4ae1-8bd0-eb9f4ff800b2",
        "code": "OMS-LS-86AEC6",
        "phone": "6289514779679",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T03:54:47.947Z",
        "updatedAt": "2026-08-13T03:54:47.947Z",
        "deletedAt": null
      },
      {
        "id": "1f71aaa9-118b-4bdf-9f1e-0f29c691f2c3",
        "code": "OMS-LS-1EA409",
        "phone": "6288971554545",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T02:49:58.317Z",
        "updatedAt": "2026-08-14T02:49:58.317Z",
        "deletedAt": null
      },
      {
        "id": "22949252-6ffa-4c19-9540-5b155545f2e7",
        "code": "OMS-LS-E8B220",
        "phone": "6285341908959",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T12:28:59.525Z",
        "updatedAt": "2026-08-13T12:28:59.525Z",
        "deletedAt": null
      },
      {
        "id": "249d7bed-86bb-4122-9e27-26e3c7348f18",
        "code": "OMS-LS-E54C1B",
        "phone": "6281345369684",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T03:07:42.482Z",
        "updatedAt": "2026-08-14T03:07:42.482Z",
        "deletedAt": null
      },
      {
        "id": "2e6bd329-b826-47a1-b882-b88f29f863f1",
        "code": "OMS-LS-EDBF65",
        "phone": "6285708305563",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:14:16.751Z",
        "updatedAt": "2026-08-13T14:14:16.751Z",
        "deletedAt": null
      },
      {
        "id": "364d3d95-9e73-4ef2-8b6e-b3963622d9f3",
        "code": "OMS-LS-A78108",
        "phone": "6282279992867",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T09:34:25.516Z",
        "updatedAt": "2026-08-11T09:34:25.516Z",
        "deletedAt": null
      },
      {
        "id": "38f41a54-cc2f-46a4-a248-3c25a795fe4e",
        "code": "OMS-LS-C3B61E",
        "phone": "628112268818",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:48:44.635Z",
        "updatedAt": "2026-08-13T14:48:44.635Z",
        "deletedAt": null
      },
      {
        "id": "3906c735-b29e-4f8e-acc7-3b802404e200",
        "code": "OMS-LS-F801D6",
        "phone": "6281215103735",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:42:47.409Z",
        "updatedAt": "2026-08-13T14:42:47.409Z",
        "deletedAt": null
      },
      {
        "id": "3c8f488e-00cc-4c46-949e-3858607d4924",
        "code": "OMS-LS-32AB8A",
        "phone": "6289677824004",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T07:28:46.087Z",
        "updatedAt": "2026-08-14T07:28:46.087Z",
        "deletedAt": null
      },
      {
        "id": "42214eb7-cdfc-4618-b015-ea7077f94e23",
        "code": "OMS-LS-9842FD",
        "phone": "6281908159595",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-12T05:42:25.190Z",
        "updatedAt": "2026-08-12T05:42:25.190Z",
        "deletedAt": null
      },
      {
        "id": "4446d165-ae63-4079-ab98-4c860517693a",
        "code": "OMS-LS-9AD795",
        "phone": "6285136698288",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T05:02:48.499Z",
        "updatedAt": "2026-08-13T05:02:48.499Z",
        "deletedAt": null
      },
      {
        "id": "446f497e-880c-42a6-8d11-1e4fb98dd67f",
        "code": "OMS-LS-DE36F0",
        "phone": "6282378696225",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T15:12:54.595Z",
        "updatedAt": "2026-08-13T15:12:54.595Z",
        "deletedAt": null
      },
      {
        "id": "44bbea4b-1236-4377-b3c4-8ec1b694738d",
        "code": "OMS-LS-7DAE9B",
        "phone": "6281311242889",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T01:11:52.986Z",
        "updatedAt": "2026-08-14T01:11:52.986Z",
        "deletedAt": null
      },
      {
        "id": "45524f9c-ca87-4438-b0f5-66c3aed9ac32",
        "code": "OMS-LS-CB01F4",
        "phone": "6282143140890",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T07:30:26.917Z",
        "updatedAt": "2026-08-14T07:30:26.917Z",
        "deletedAt": null
      },
      {
        "id": "485bdabe-4690-43c5-af45-6a55f0b30499",
        "code": "OMS-LS-513D82",
        "phone": "6282146792414",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:03:51.943Z",
        "updatedAt": "2026-08-13T13:03:51.943Z",
        "deletedAt": null
      },
      {
        "id": "4a778b16-d431-4e06-8182-4e632011761c",
        "code": "OMS-LS-DB8303",
        "phone": "6281281579997",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:58:25.518Z",
        "updatedAt": "2026-08-13T14:58:25.518Z",
        "deletedAt": null
      },
      {
        "id": "4d678121-b3c7-43c5-8ef0-b621bedb71de",
        "code": "OMS-LS-95E067",
        "phone": "6282189480749",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T12:25:37.227Z",
        "updatedAt": "2026-08-13T12:25:37.227Z",
        "deletedAt": null
      },
      {
        "id": "4ecf6433-0551-4b10-b169-baa82df8d75a",
        "code": "OMS-LS-BECDC5",
        "phone": "6281216574189",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T08:34:56.805Z",
        "updatedAt": "2026-08-13T08:34:56.805Z",
        "deletedAt": null
      },
      {
        "id": "4f2cb886-3e96-4401-beac-725c178c116a",
        "code": "OMS-LS-0E6781",
        "phone": "6289601195954",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T03:03:05.901Z",
        "updatedAt": "2026-08-13T03:03:05.901Z",
        "deletedAt": null
      },
      {
        "id": "589cc1d8-8957-4b0e-9f7c-583537695770",
        "code": "OMS-LS-AEA75B",
        "phone": "6281290035505",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T17:43:35.442Z",
        "updatedAt": "2026-08-13T17:43:35.442Z",
        "deletedAt": null
      },
      {
        "id": "5aafb2db-3aff-4f2b-a10d-d66dc7332544",
        "code": "OMS-LS-567492",
        "phone": "6282132083144",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T07:29:55.174Z",
        "updatedAt": "2026-08-14T07:29:55.174Z",
        "deletedAt": null
      },
      {
        "id": "5d44757b-c10c-438a-9a35-bc44ba2db74e",
        "code": "OMS-LS-7496F6",
        "phone": "6282283902338",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T01:17:38.778Z",
        "updatedAt": "2026-08-13T01:17:38.778Z",
        "deletedAt": null
      },
      {
        "id": "5e2ad426-558f-409f-a9a9-c50be26898d0",
        "code": "OMS-LS-AE7B9B",
        "phone": "6282387066130",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T02:59:17.037Z",
        "updatedAt": "2026-08-14T02:59:17.037Z",
        "deletedAt": null
      },
      {
        "id": "5ef3dffc-fde6-476f-bc58-55a489ecf723",
        "code": "OMS-LS-53CB6C",
        "phone": "6281322821739",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T11:08:28.846Z",
        "updatedAt": "2026-08-13T11:08:28.846Z",
        "deletedAt": null
      },
      {
        "id": "67265e85-5642-46da-a098-f2d30f647c1c",
        "code": "OMS-LS-886651",
        "phone": "6281263223569",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T07:56:56.259Z",
        "updatedAt": "2026-08-11T07:56:56.259Z",
        "deletedAt": null
      },
      {
        "id": "693a3d33-b353-4711-9eae-ab5aebf31b0a",
        "code": "OMS-LS-77DCDC",
        "phone": "6281389123483",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T12:53:52.099Z",
        "updatedAt": "2026-08-11T12:53:52.099Z",
        "deletedAt": null
      },
      {
        "id": "698d0daf-c72c-4e27-aff7-5b2a91a7935d",
        "code": "OMS-LS-679CE0",
        "phone": "6285717343174",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T00:10:46.183Z",
        "updatedAt": "2026-08-14T00:10:46.183Z",
        "deletedAt": null
      },
      {
        "id": "6b619143-d588-478b-a4a3-08fee58d9de2",
        "code": "OMS-LS-1D3714",
        "phone": "6281291581654",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T03:18:46.089Z",
        "updatedAt": "2026-08-14T03:18:46.089Z",
        "deletedAt": null
      },
      {
        "id": "7196fb59-576a-46d2-bb64-f17038730fa2",
        "code": "OMS-LS-84C1AB",
        "phone": "62895331621232",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T02:42:08.815Z",
        "updatedAt": "2026-08-13T02:42:08.815Z",
        "deletedAt": null
      },
      {
        "id": "73c88ba6-8d11-41f9-9fde-5ea00e6cdb9d",
        "code": "OMS-LS-98A0CD",
        "phone": "6282125980614",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:40:08.664Z",
        "updatedAt": "2026-08-13T14:40:08.664Z",
        "deletedAt": null
      },
      {
        "id": "8a50a3f7-eeb2-4999-a679-121599005647",
        "code": "OMS-LS-E8F55B",
        "phone": "6281295567465",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T16:07:04.912Z",
        "updatedAt": "2026-08-11T16:07:04.912Z",
        "deletedAt": null
      },
      {
        "id": "8fd2ebba-5ba7-4fff-8bc7-9462c6ffbb1b",
        "code": "OMS-LS-6125FA",
        "phone": "6281543416322",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-09T23:11:19.221Z",
        "updatedAt": "2026-08-09T23:11:19.221Z",
        "deletedAt": null
      },
      {
        "id": "90defcc7-a9fc-4412-9059-d3d8fe1c0939",
        "code": "OMS-LS-B0770C",
        "phone": "6281368059700",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T23:43:41.345Z",
        "updatedAt": "2026-08-13T23:43:41.345Z",
        "deletedAt": null
      },
      {
        "id": "9304fb89-c3e9-4404-b8c1-e0d8d560688a",
        "code": "OMS-LS-CC9BA4",
        "phone": "6281703399966",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T10:51:12.189Z",
        "updatedAt": "2026-08-13T10:51:12.189Z",
        "deletedAt": null
      },
      {
        "id": "94bc43d6-b746-4730-b71a-a37df6f5b956",
        "code": "OMS-LS-7520D3",
        "phone": "6282299889975",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T16:13:35.396Z",
        "updatedAt": "2026-08-13T16:13:35.396Z",
        "deletedAt": null
      },
      {
        "id": "9b5cf388-80a8-4ad9-9bfc-e5ef867b3125",
        "code": "OMS-LS-92DA3B",
        "phone": "62895325542724",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T23:22:26.833Z",
        "updatedAt": "2026-08-11T23:22:26.833Z",
        "deletedAt": null
      },
      {
        "id": "9bedb989-afc1-401d-9130-2b748d02a878",
        "code": "OMS-LS-FB29C2",
        "phone": "6281360452624",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T16:19:22.205Z",
        "updatedAt": "2026-08-11T16:19:22.205Z",
        "deletedAt": null
      },
      {
        "id": "9c0e6b81-b548-48d4-8cde-776264b5ce33",
        "code": "OMS-LS-0A1FBA",
        "phone": "6287885460903",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T07:04:58.099Z",
        "updatedAt": "2026-08-13T07:04:58.099Z",
        "deletedAt": null
      },
      {
        "id": "9c7db9f0-0c96-4216-9b93-43aaa7790abb",
        "code": "OMS-LS-72D847",
        "phone": "62895630320648",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T23:12:49.228Z",
        "updatedAt": "2026-08-13T23:12:49.228Z",
        "deletedAt": null
      },
      {
        "id": "9c9b87d1-7192-47b3-adb5-3cc815b50092",
        "code": "OMS-LS-AB7438",
        "phone": "6282295939097",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T17:27:30.097Z",
        "updatedAt": "2026-08-13T17:27:30.097Z",
        "deletedAt": null
      },
      {
        "id": "9d1a187e-e3f6-4b69-87d2-6be8d7db1dba",
        "code": "OMS-LS-38A7C7",
        "phone": "6289526295785",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T03:52:49.920Z",
        "updatedAt": "2026-08-14T03:52:49.920Z",
        "deletedAt": null
      },
      {
        "id": "9e65f1fb-b12c-467b-a527-d076cf8f464d",
        "code": "OMS-LS-051CEC",
        "phone": "6285177445661",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T16:36:46.190Z",
        "updatedAt": "2026-08-13T16:36:46.190Z",
        "deletedAt": null
      },
      {
        "id": "a2f149fa-d91d-4e2c-9297-bdfd5d68b292",
        "code": "OMS-LS-20AB2B",
        "phone": "62811344833",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:17:16.441Z",
        "updatedAt": "2026-08-13T13:17:16.441Z",
        "deletedAt": null
      },
      {
        "id": "a4c9a85b-3424-46eb-9a85-47d59a01f5b3",
        "code": "OMS-LS-10DAB0",
        "phone": "6285813134333",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:02:29.833Z",
        "updatedAt": "2026-08-13T14:02:29.833Z",
        "deletedAt": null
      },
      {
        "id": "a7992142-e9a5-4d2b-8049-798a661c894b",
        "code": "OMS-LS-4A8FEC",
        "phone": "6282199955469",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T07:17:06.181Z",
        "updatedAt": "2026-08-13T07:17:06.181Z",
        "deletedAt": null
      },
      {
        "id": "a89d686b-ab3d-4dca-b0b7-8d92f783a6e6",
        "code": "OMS-LS-5A2900",
        "phone": "6282214147374",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-12T15:15:49.468Z",
        "updatedAt": "2026-08-12T15:15:49.468Z",
        "deletedAt": null
      },
      {
        "id": "a94bcab0-2d2b-4b49-aeb2-99e6beef1ec3",
        "code": "OMS-LS-EB7A80",
        "phone": "628813135450",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:15:17.828Z",
        "updatedAt": "2026-08-13T14:15:17.828Z",
        "deletedAt": null
      },
      {
        "id": "aa30606e-602f-4065-961d-61accfc48c02",
        "code": "OMS-LS-B00BBE",
        "phone": "6283148813301",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T12:55:55.653Z",
        "updatedAt": "2026-08-13T12:55:55.653Z",
        "deletedAt": null
      },
      {
        "id": "aa71d8ce-0977-430f-93ec-32b4e2354096",
        "code": "OMS-LS-062538",
        "phone": "6289664059874",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T15:05:54.962Z",
        "updatedAt": "2026-08-13T15:05:54.962Z",
        "deletedAt": null
      },
      {
        "id": "ac22b9e7-6c27-46cb-8c51-814a46c65a86",
        "code": "OMS-LS-3F4742",
        "phone": "6282255522992",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T06:41:57.594Z",
        "updatedAt": "2026-08-13T06:41:57.594Z",
        "deletedAt": null
      },
      {
        "id": "ac6fffc2-66c6-43ec-9a3d-ae784e5bf2c4",
        "code": "OMS-LS-5453C9",
        "phone": "628987410110",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T16:57:01.933Z",
        "updatedAt": "2026-08-13T16:57:01.933Z",
        "deletedAt": null
      },
      {
        "id": "ad90452e-9450-4d7a-bca5-3c4758c503d1",
        "code": "OMS-LS-54988D",
        "phone": "628952629575",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T03:53:36.482Z",
        "updatedAt": "2026-08-14T03:53:36.482Z",
        "deletedAt": null
      },
      {
        "id": "b7336e7b-2391-4fa7-9d5d-14af80437f26",
        "code": "OMS-LS-9AE43D",
        "phone": "6287855006868",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T04:23:51.454Z",
        "updatedAt": "2026-08-14T04:23:51.454Z",
        "deletedAt": null
      },
      {
        "id": "ba1fb67c-07b0-486e-8ec1-7a5051de16a9",
        "code": "OMS-LS-5F174A",
        "phone": "628116659399",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T01:49:13.230Z",
        "updatedAt": "2026-08-13T01:49:13.230Z",
        "deletedAt": null
      },
      {
        "id": "bed1c01e-f153-4638-a94b-cef97416adfb",
        "code": "OMS-LS-E4ED26",
        "phone": "6289677991917",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T16:09:57.902Z",
        "updatedAt": "2026-08-13T16:09:57.902Z",
        "deletedAt": null
      },
      {
        "id": "bfe1c5b9-d9fe-4090-9e7d-046aec1bc449",
        "code": "OMS-LS-5746F3",
        "phone": "6285643305459",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T09:19:22.628Z",
        "updatedAt": "2026-08-13T09:19:22.628Z",
        "deletedAt": null
      },
      {
        "id": "c07aa070-757f-4d1c-817b-23ff0e40195e",
        "code": "OMS-LS-4CAA1E",
        "phone": "6285724033354",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-05T10:35:51.254Z",
        "updatedAt": "2026-08-05T10:35:51.254Z",
        "deletedAt": null
      },
      {
        "id": "c21129a1-bd6b-440b-b383-5c66325688a9",
        "code": "OMS-LS-596421",
        "phone": "6285333093550",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T06:50:04.752Z",
        "updatedAt": "2026-08-14T06:50:04.752Z",
        "deletedAt": null
      },
      {
        "id": "c322655f-d790-4bf7-9873-a1a7a7249798",
        "code": "OMS-LS-646AD1",
        "phone": "6282179354035",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:15:58.424Z",
        "updatedAt": "2026-08-13T14:15:58.424Z",
        "deletedAt": null
      },
      {
        "id": "ca574795-ddf0-4740-96a5-e87a5a3e08c6",
        "code": "OMS-LS-003957",
        "phone": "6281266926404",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T08:53:30.937Z",
        "updatedAt": "2026-08-13T08:53:30.937Z",
        "deletedAt": null
      },
      {
        "id": "cca90a86-8a83-4ae5-99ac-00312189cb32",
        "code": "OMS-LS-3E00FC",
        "phone": "62811237820",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:41:02.160Z",
        "updatedAt": "2026-08-13T13:41:02.160Z",
        "deletedAt": null
      },
      {
        "id": "cd0c5418-7377-413a-9e78-c042dcf8b769",
        "code": "OMS-LS-D3631D",
        "phone": "6285235802179",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T09:33:39.044Z",
        "updatedAt": "2026-08-13T09:33:39.044Z",
        "deletedAt": null
      },
      {
        "id": "cfc94e1b-196e-4653-8bf9-6cc638bc2964",
        "code": "OMS-LS-3D51CD",
        "phone": "6285351036211",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T00:14:44.825Z",
        "updatedAt": "2026-08-13T00:14:44.825Z",
        "deletedAt": null
      },
      {
        "id": "d4cccce8-8221-4ecf-88ea-908718c09f56",
        "code": "OMS-LS-D4BEAA",
        "phone": "628567144126",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:56:00.167Z",
        "updatedAt": "2026-08-13T13:56:00.167Z",
        "deletedAt": null
      },
      {
        "id": "d58bf211-fbb1-4669-96d2-b4b18038f735",
        "code": "OMS-LS-E0DD7B",
        "phone": "6281388314959",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:39:19.537Z",
        "updatedAt": "2026-08-13T14:39:19.537Z",
        "deletedAt": null
      },
      {
        "id": "d5da5218-78ad-49c6-a3c4-a59b4f5618ff",
        "code": "OMS-LS-AFBEAC",
        "phone": "6283819238614",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T05:44:53.096Z",
        "updatedAt": "2026-08-14T05:44:53.096Z",
        "deletedAt": null
      },
      {
        "id": "d847a0e1-302d-4193-9c22-af6a80e34fa7",
        "code": "OMS-LS-BDE303",
        "phone": "6281380810177",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T01:57:32.678Z",
        "updatedAt": "2026-08-13T01:57:32.678Z",
        "deletedAt": null
      },
      {
        "id": "d8666a6a-8c05-46e8-bf1b-64da37d9c90a",
        "code": "OMS-LS-F48EE6",
        "phone": "6285778619885",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T14:02:56.905Z",
        "updatedAt": "2026-08-13T14:02:56.905Z",
        "deletedAt": null
      },
      {
        "id": "d875d4c7-7fc6-426c-9705-fc3cb7ba3b88",
        "code": "OMS-LS-A1E224",
        "phone": "6281241506292",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T15:19:02.226Z",
        "updatedAt": "2026-08-13T15:19:02.226Z",
        "deletedAt": null
      },
      {
        "id": "d9f512bb-e2cb-48bc-a0b6-0f73b1088531",
        "code": "OMS-LS-71500B",
        "phone": "6285743892873",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T01:37:01.679Z",
        "updatedAt": "2026-08-13T01:37:01.679Z",
        "deletedAt": null
      },
      {
        "id": "de4761e9-d5cb-40f8-b1de-e9293a0ca212",
        "code": "OMS-LS-0B1A45",
        "phone": "6281284306949",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:11:04.209Z",
        "updatedAt": "2026-08-13T13:11:04.209Z",
        "deletedAt": null
      },
      {
        "id": "e0d1ffe7-8006-4298-b5b5-836efd42f653",
        "code": "OMS-LS-6184B4",
        "phone": "6281615552518",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T08:06:55.738Z",
        "updatedAt": "2026-08-14T08:06:55.738Z",
        "deletedAt": null
      },
      {
        "id": "e1ad2f9a-2dda-49ab-a674-47fec6ef7bc2",
        "code": "OMS-LS-59D2A8",
        "phone": "6281234567890",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-11T07:52:04.030Z",
        "updatedAt": "2026-08-11T07:52:04.030Z",
        "deletedAt": null
      },
      {
        "id": "e2dc5329-a624-4806-afc7-ef39a91e99b7",
        "code": "OMS-LS-B519FB",
        "phone": "6282233524352",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T19:27:46.598Z",
        "updatedAt": "2026-08-13T19:27:46.598Z",
        "deletedAt": null
      },
      {
        "id": "f112319c-6285-4fc8-89c8-540b368d2b47",
        "code": "OMS-LS-A95A78",
        "phone": "6288269632855",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-12T18:31:27.082Z",
        "updatedAt": "2026-08-12T18:31:27.082Z",
        "deletedAt": null
      },
      {
        "id": "f11f59fb-9f97-4e20-b4c1-7a58bf1d8da2",
        "code": "OMS-LS-380243",
        "phone": "6285156940110",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:50:09.844Z",
        "updatedAt": "2026-08-13T13:50:09.844Z",
        "deletedAt": null
      },
      {
        "id": "f9522cfb-b691-475f-9c0c-12ddc95ae918",
        "code": "OMS-LS-EBF2F5",
        "phone": "6282229998848",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-14T03:28:45.793Z",
        "updatedAt": "2026-08-14T03:28:45.793Z",
        "deletedAt": null
      },
      {
        "id": "f95a8170-5ee2-4876-9d60-998c2f08ee40",
        "code": "OMS-LS-877171",
        "phone": "628116870414",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T16:05:36.565Z",
        "updatedAt": "2026-08-13T16:05:36.565Z",
        "deletedAt": null
      },
      {
        "id": "fae7b083-29c6-4270-810f-9960384fd377",
        "code": "OMS-LS-478A83",
        "phone": "6285343603654",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T12:16:49.697Z",
        "updatedAt": "2026-08-13T12:16:49.697Z",
        "deletedAt": null
      },
      {
        "id": "ff01b3ec-0ac2-4142-8c42-486d10d426db",
        "code": "OMS-LS-792A5F",
        "phone": "628128880721",
        "countryCode": "ID",
        "source": "launch-page",
        "status": "SUBSCRIBED",
        "launchNotifiedAt": null,
        "notes": "",
        "createdAt": "2026-08-13T13:26:30.472Z",
        "updatedAt": "2026-08-13T13:26:30.472Z",
        "deletedAt": null
      }
    ]
  }
} as const;

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        DATE_FIELDS.has(key) && typeof entry === 'string' ? new Date(entry) : reviveDates(entry),
      ]),
    ) as T;
  }

  return value;
}

function withoutId<T extends { id: string }>(row: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = row;
  return rest;
}

async function upsertRows<T extends { id: string }>(
  label: string,
  delegate: { upsert(args: { where: { id: string }; create: any; update: any }): Promise<unknown> },
  rows: readonly T[],
) {
  for (const rawRow of rows) {
    const row = reviveDates(rawRow) as T;
    await delegate.upsert({
      where: { id: row.id },
      create: row,
      update: withoutId(row),
    });
  }
  console.log(`[seed:ecommerce-snapshot] ${label}: ${rows.length} rows`);
}

async function main() {
  console.log('[seed:ecommerce-snapshot] Starting snapshot restore from seed-ecommerce-snapshot-2026-08-14.ts');
  console.log('[seed:ecommerce-snapshot] Snapshot generated at:', SNAPSHOT.generatedAt);

  // Parent records first.
  await upsertRows('Product', prisma.product, SNAPSHOT.models.Product);
  await upsertRows('WebsiteCollectionHero', prisma.websiteCollectionHero, SNAPSHOT.models.WebsiteCollectionHero);

  // Child records after parents to preserve foreign-key relationships.
  await upsertRows('ProductGallery', prisma.productGallery, SNAPSHOT.models.ProductGallery);
  await upsertRows('ProductShowcase', prisma.productShowcase, SNAPSHOT.models.ProductShowcase);
  await upsertRows('Inventory', prisma.inventory, SNAPSHOT.models.Inventory);
  await upsertRows('WebsiteHero', prisma.websiteHero, SNAPSHOT.models.WebsiteHero);
  await upsertRows('WebsiteCollectionHeroMedia', prisma.websiteCollectionHeroMedia, SNAPSHOT.models.WebsiteCollectionHeroMedia);
  await upsertRows('WebsiteProductStory', prisma.websiteProductStory, SNAPSHOT.models.WebsiteProductStory);
  await upsertRows('Faq', prisma.faq, SNAPSHOT.models.Faq);
  await upsertRows('LaunchSubscriber', prisma.launchSubscriber, SNAPSHOT.models.LaunchSubscriber);

  console.log('[seed:ecommerce-snapshot] Completed snapshot restore.');
}

main()
  .catch((error) => {
    console.error('[seed:ecommerce-snapshot] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
