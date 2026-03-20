/**
 * Database Seed Script
 * Seeds MongoDB with 116 hotels and 52 packages.
 * Uses raw MongoDB collection driver to bypass all Mongoose schema validation.
 *
 * Run:     node Backendd/utils/seedData.js
 * Reseed:  node Backendd/utils/seedData.js --force
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not found in .env');
  process.exit(1);
}

const HOTELS = [
  {
    "staticId": 1,
    "name": "The Oberoi Cecil, Shimla",
    "location": {
      "city": "Chaura Maidan",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chaura Maidan, Shimla"
    },
    "area": "Mall Road Area",
    "category": "luxury",
    "starRating": 5,
    "description": "The Oberoi Cecil, Shimla \u2014 a quality hotel in Chaura Maidan offering comfortable stays.",
    "basePrice": 15000,
    "rating": 4.8,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 2,
    "name": "Wildflower Hall, An Oberoi Resort, Shimla",
    "location": {
      "city": "Mashobra",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mashobra, Shimla"
    },
    "area": "Mashobra",
    "category": "luxury",
    "starRating": 5,
    "description": "Wildflower Hall, An Oberoi Resort, Shimla \u2014 a quality hotel in Mashobra offering comfortable stays.",
    "basePrice": 20000,
    "rating": 4.9,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 3,
    "name": "Welcomhotel by ITC Hotels, Tavleen, Shimla",
    "location": {
      "city": "Village Patangali",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Village Patangali, Mashobra"
    },
    "area": "Mashobra",
    "category": "luxury",
    "starRating": 5,
    "description": "Welcomhotel by ITC Hotels, Tavleen, Shimla \u2014 a quality hotel in Village Patangali offering comfortable stays.",
    "basePrice": 13000,
    "rating": 4.7,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 4,
    "name": "Taj Theog Resort & Spa",
    "location": {
      "city": "Tehsil Theog",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Tehsil Theog, Shimla"
    },
    "area": "Theog",
    "category": "luxury",
    "starRating": 5,
    "description": "Taj Theog Resort & Spa \u2014 a quality hotel in Tehsil Theog offering comfortable stays.",
    "basePrice": 14000,
    "rating": 4.8,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 5,
    "name": "The Orchid Hotel Shimla",
    "location": {
      "city": "Kamla Nagar",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kamla Nagar, Sanjauli, Shimla"
    },
    "area": "Sanjauli",
    "category": "premium",
    "starRating": 4,
    "description": "The Orchid Hotel Shimla \u2014 a quality hotel in Kamla Nagar offering comfortable stays.",
    "basePrice": 8500,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 7,
    "name": "Clarkes Hotel - A Grand Heritage Hotel Since 1898",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "premium",
    "starRating": 4,
    "description": "Clarkes Hotel - A Grand Heritage Hotel Since 1898 \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 8000,
    "rating": 4.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 8,
    "name": "Marigold Sarovar Portico Resort & Spa",
    "location": {
      "city": "Kufri - Chail Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kufri - Chail Road, Shimla"
    },
    "area": "Kufri",
    "category": "premium",
    "starRating": 4,
    "description": "Marigold Sarovar Portico Resort & Spa \u2014 a quality hotel in Kufri - Chail Road offering comfortable stays.",
    "basePrice": 7200,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 9,
    "name": "WelcomHeritage Elysium Resort & Spa",
    "location": {
      "city": "Village Sadhora",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Village Sadhora, Mashobra-Naldera Road"
    },
    "area": "Mashobra",
    "category": "premium",
    "starRating": 4,
    "description": "WelcomHeritage Elysium Resort & Spa \u2014 a quality hotel in Village Sadhora offering comfortable stays.",
    "basePrice": 9500,
    "rating": 4.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 10,
    "name": "Woodville Palace - A Heritage Property Since 1938",
    "location": {
      "city": "Raj Bhawan Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Raj Bhawan Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "premium",
    "starRating": 4,
    "description": "Woodville Palace - A Heritage Property Since 1938 \u2014 a quality hotel in Raj Bhawan Road offering comfortable stays.",
    "basePrice": 9000,
    "rating": 4.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 11,
    "name": "Hotel Willow Banks",
    "location": {
      "city": "Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "premium",
    "starRating": 4,
    "description": "Hotel Willow Banks \u2014 a quality hotel in Mall Road offering comfortable stays.",
    "basePrice": 9600,
    "rating": 4.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 12,
    "name": "The Cedar Grand Hotel & Spa",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "luxury",
    "starRating": 4,
    "description": "The Cedar Grand Hotel & Spa \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 11000,
    "rating": 4.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 13,
    "name": "Sterling Kufri",
    "location": {
      "city": "Fagu",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fagu, Kufri"
    },
    "area": "Kufri",
    "category": "premium",
    "starRating": 4,
    "description": "Sterling Kufri \u2014 a quality hotel in Fagu offering comfortable stays.",
    "basePrice": 7500,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 14,
    "name": "Fortune Park Kufri - Member ITC Hotels",
    "location": {
      "city": "Kufri Bypass Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kufri Bypass Road, Shimla"
    },
    "area": "Kufri",
    "category": "premium",
    "starRating": 4,
    "description": "Fortune Park Kufri - Member ITC Hotels \u2014 a quality hotel in Kufri Bypass Road offering comfortable stays.",
    "basePrice": 6800,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 15,
    "name": "Springfields - A Heritage Palace Since 1902",
    "location": {
      "city": "Chotta Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chotta Shimla, Shimla"
    },
    "area": "Chotta Shimla",
    "category": "premium",
    "starRating": 4,
    "description": "Springfields - A Heritage Palace Since 1902 \u2014 a quality hotel in Chotta Shimla offering comfortable stays.",
    "basePrice": 7200,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 16,
    "name": "East Bourne Resort & Spa",
    "location": {
      "city": "Near Bishop Cotton School",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Bishop Cotton School, Khalini, Shimla"
    },
    "area": "Khalini",
    "category": "premium",
    "starRating": 4,
    "description": "East Bourne Resort & Spa \u2014 a quality hotel in Near Bishop Cotton School offering comfortable stays.",
    "basePrice": 6500,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 17,
    "name": "Shimla British Resort",
    "location": {
      "city": "Chharabra",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chharabra, Shimla"
    },
    "area": "Chharabra",
    "category": "premium",
    "starRating": 3,
    "description": "Shimla British Resort \u2014 a quality hotel in Chharabra offering comfortable stays.",
    "basePrice": 5800,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 18,
    "name": "Hotel Marina - Shimla First Designer Boutique Hotel",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "premium",
    "starRating": 4,
    "description": "Hotel Marina - Shimla First Designer Boutique Hotel \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 8500,
    "rating": 4.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 19,
    "name": "Snow Valley Resorts",
    "location": {
      "city": "Fingask Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fingask Estate, Shimla"
    },
    "area": "Fingask",
    "category": "premium",
    "starRating": 3,
    "description": "Snow Valley Resorts \u2014 a quality hotel in Fingask Estate offering comfortable stays.",
    "basePrice": 5500,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 20,
    "name": "8fold by LaRiSa",
    "location": {
      "city": "Kachi Ghatti",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kachi Ghatti, Shimla"
    },
    "area": "Kachi Ghatti",
    "category": "premium",
    "starRating": 3,
    "description": "8fold by LaRiSa \u2014 a quality hotel in Kachi Ghatti offering comfortable stays.",
    "basePrice": 5600,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 21,
    "name": "Regenta Resort & Spa Mashobra",
    "location": {
      "city": "Mashobra",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mashobra, Shimla"
    },
    "area": "Mashobra",
    "category": "premium",
    "starRating": 4,
    "description": "Regenta Resort & Spa Mashobra \u2014 a quality hotel in Mashobra offering comfortable stays.",
    "basePrice": 7800,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 22,
    "name": "dusitD2 Fagu",
    "location": {
      "city": "Fagu",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fagu, Shimla"
    },
    "area": "Fagu",
    "category": "premium",
    "starRating": 4,
    "description": "dusitD2 Fagu \u2014 a quality hotel in Fagu offering comfortable stays.",
    "basePrice": 8500,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 23,
    "name": "Keys Select by Lemon Tree Hotels, Kufri",
    "location": {
      "city": "Kufri",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kufri, Shimla"
    },
    "area": "Kufri",
    "category": "premium",
    "starRating": 3,
    "description": "Keys Select by Lemon Tree Hotels, Kufri \u2014 a quality hotel in Kufri offering comfortable stays.",
    "basePrice": 6200,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 24,
    "name": "Hotel Combermere",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "premium",
    "starRating": 4,
    "description": "Hotel Combermere \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 8000,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 25,
    "name": "Honeymoon Inn Shimla",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Honeymoon Inn Shimla \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 4500,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 26,
    "name": "Koti Resort Shimla - Member of Radisson Individuals",
    "location": {
      "city": "Koti",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Koti, Shimla"
    },
    "area": "Koti",
    "category": "premium",
    "starRating": 4,
    "description": "Koti Resort Shimla - Member of Radisson Individuals \u2014 a quality hotel in Koti offering comfortable stays.",
    "basePrice": 6800,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 27,
    "name": "Woodsmoke Resort & Spa",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "premium",
    "starRating": 3,
    "description": "Woodsmoke Resort & Spa \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 7200,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 28,
    "name": "Ashiana Clarks Inn",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "premium",
    "starRating": 3,
    "description": "Ashiana Clarks Inn \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 5500,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 29,
    "name": "Snow King Retreat",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "premium",
    "starRating": 4,
    "description": "Snow King Retreat \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 6000,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 30,
    "name": "Hotel Landmark Shimla",
    "location": {
      "city": "Near AG Office",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near AG Office, The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Landmark Shimla \u2014 a quality hotel in Near AG Office offering comfortable stays.",
    "basePrice": 4800,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 31,
    "name": "Treebo The Alpine Heritage Residency",
    "location": {
      "city": "Milsington Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Milsington Estate, Chotta Shimla"
    },
    "area": "Chotta Shimla",
    "category": "mid-range",
    "starRating": 3,
    "description": "Treebo The Alpine Heritage Residency \u2014 a quality hotel in Milsington Estate offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 32,
    "name": "Treebo Varuna with Mountain View",
    "location": {
      "city": "Sherwood Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Sherwood Estate, Gorton Castle Square, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Treebo Varuna with Mountain View \u2014 a quality hotel in Sherwood Estate offering comfortable stays.",
    "basePrice": 3800,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 33,
    "name": "Hotel Baljees Regency",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Baljees Regency \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 4200,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 34,
    "name": "Gulmarg Regency",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Gulmarg Regency \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 35,
    "name": "Hotel Shingar",
    "location": {
      "city": "The Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Shingar \u2014 a quality hotel in The Mall Road offering comfortable stays.",
    "basePrice": 3500,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 36,
    "name": "Le Talbot Hotel",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Le Talbot Hotel \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 3000,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 37,
    "name": "Hotel Prestige",
    "location": {
      "city": "Sabzi Mandi Ground",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Sabzi Mandi Ground, Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Prestige \u2014 a quality hotel in Sabzi Mandi Ground offering comfortable stays.",
    "basePrice": 2600,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 38,
    "name": "Hotel Hill Top",
    "location": {
      "city": "Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Hill Top \u2014 a quality hotel in Mall Road offering comfortable stays.",
    "basePrice": 2400,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 39,
    "name": "Brightland Hotel",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Brightland Hotel \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 4000,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 40,
    "name": "Pineview Shimla",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Pineview Shimla \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 3800,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 41,
    "name": "Hotel Atithi",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Atithi \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 2200,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 42,
    "name": "Hotel Sangeet Mall Road",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Sangeet Mall Road \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 3600,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 43,
    "name": "Hotel Amar Villa",
    "location": {
      "city": "Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Amar Villa \u2014 a quality hotel in Mall Road offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 44,
    "name": "Hotel Ganga",
    "location": {
      "city": "Fingask Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fingask Estate, Shimla"
    },
    "area": "Fingask",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Ganga \u2014 a quality hotel in Fingask Estate offering comfortable stays.",
    "basePrice": 2400,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 45,
    "name": "Hotel Basera",
    "location": {
      "city": "Fingask Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fingask Estate, Mall Road, Shimla"
    },
    "area": "Fingask",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Basera \u2014 a quality hotel in Fingask Estate offering comfortable stays.",
    "basePrice": 2000,
    "rating": 3.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 46,
    "name": "Hotel Silverine",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Silverine \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 47,
    "name": "Alpine Regency",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Alpine Regency \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 2900,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 48,
    "name": "Hotel Aachman Regency",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Aachman Regency \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3800,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 49,
    "name": "Hotel Firhill",
    "location": {
      "city": "Chaura Maidan",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chaura Maidan, Shimla"
    },
    "area": "Chaura Maidan",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Firhill \u2014 a quality hotel in Chaura Maidan offering comfortable stays.",
    "basePrice": 4000,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 50,
    "name": "Hotel Kalra Regency",
    "location": {
      "city": "Chotta Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chotta Shimla, Shimla"
    },
    "area": "Chotta Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Kalra Regency \u2014 a quality hotel in Chotta Shimla offering comfortable stays.",
    "basePrice": 2900,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 51,
    "name": "Hotel Himland East",
    "location": {
      "city": "Himland",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Himland, Shimla"
    },
    "area": "Himland",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Himland East \u2014 a quality hotel in Himland offering comfortable stays.",
    "basePrice": 3500,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 52,
    "name": "Green Forest View",
    "location": {
      "city": "Chaura Maidan",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chaura Maidan, Shimla"
    },
    "area": "Chaura Maidan",
    "category": "mid-range",
    "starRating": 3,
    "description": "Green Forest View \u2014 a quality hotel in Chaura Maidan offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 53,
    "name": "Hotel Harsha",
    "location": {
      "city": "Chaura Maidan",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Chaura Maidan, Shimla"
    },
    "area": "Chaura Maidan",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Harsha \u2014 a quality hotel in Chaura Maidan offering comfortable stays.",
    "basePrice": 3400,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 54,
    "name": "Hotel Classic",
    "location": {
      "city": "Near Railway Building",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Railway Building, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Classic \u2014 a quality hotel in Near Railway Building offering comfortable stays.",
    "basePrice": 2600,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 55,
    "name": "Apple Regency",
    "location": {
      "city": "Ghora Chowki",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Ghora Chowki, Shimla"
    },
    "area": "Ghora Chowki",
    "category": "mid-range",
    "starRating": 3,
    "description": "Apple Regency \u2014 a quality hotel in Ghora Chowki offering comfortable stays.",
    "basePrice": 3000,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 56,
    "name": "Apple Rose",
    "location": {
      "city": "Kachi Ghati",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kachi Ghati, Shimla"
    },
    "area": "Kachi Ghati",
    "category": "budget",
    "starRating": 3,
    "description": "Apple Rose \u2014 a quality hotel in Kachi Ghati offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 57,
    "name": "D Park",
    "location": {
      "city": "Kachi Ghati",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kachi Ghati, Shimla"
    },
    "area": "Kachi Ghati",
    "category": "budget",
    "starRating": 3,
    "description": "D Park \u2014 a quality hotel in Kachi Ghati offering comfortable stays.",
    "basePrice": 2500,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 58,
    "name": "Gulmarg Hotel",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Gulmarg Hotel \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2300,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 59,
    "name": "Hotel Himland West",
    "location": {
      "city": "Himland",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Himland, Shimla"
    },
    "area": "Himland",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Himland West \u2014 a quality hotel in Himland offering comfortable stays.",
    "basePrice": 3600,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 60,
    "name": "Hotel Dalziel",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Dalziel \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 61,
    "name": "The Hosteller Shimla",
    "location": {
      "city": "Fingask Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fingask Estate, Shimla"
    },
    "area": "Fingask",
    "category": "budget",
    "starRating": 4,
    "description": "The Hosteller Shimla \u2014 a quality hotel in Fingask Estate offering comfortable stays.",
    "basePrice": 1500,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 62,
    "name": "goSTOPS Shimla",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "goSTOPS Shimla \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1200,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 63,
    "name": "Zostel Shimla",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Zostel Shimla \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1300,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 64,
    "name": "OYO 1836 Hotel Stay",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "OYO 1836 Hotel Stay \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 65,
    "name": "OYO 3098 Hotel Hill View",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "OYO 3098 Hotel Hill View \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1600,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 66,
    "name": "Treebo Maharaja",
    "location": {
      "city": "Fingask Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Fingask Estate, Shimla"
    },
    "area": "Fingask",
    "category": "budget",
    "starRating": 3,
    "description": "Treebo Maharaja \u2014 a quality hotel in Fingask Estate offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 67,
    "name": "OYO 4725 Hotel Neelkanth",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "OYO 4725 Hotel Neelkanth \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1500,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 68,
    "name": "OYO 6427 Hotel City View",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "OYO 6427 Hotel City View \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1700,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 69,
    "name": "OYO 8234 Hotel Mountain View",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "OYO 8234 Hotel Mountain View \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 1900,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 70,
    "name": "Hotel Shiwalik Regency - The Mall Road",
    "location": {
      "city": "Near Christ Church",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Christ Church, The Ridge, Bemloi, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Shiwalik Regency - The Mall Road \u2014 a quality hotel in Near Christ Church offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 71,
    "name": "Shimla Hills Homestay",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Shimla Hills Homestay \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2200,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 72,
    "name": "Himalayan Homestay",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Himalayan Homestay \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 2000,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 73,
    "name": "Shimla Heritage Homestay",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Shimla Heritage Homestay \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2500,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 74,
    "name": "Mountain View Homestay",
    "location": {
      "city": "Totu",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Totu, Shimla"
    },
    "area": "Totu",
    "category": "budget",
    "starRating": 3,
    "description": "Mountain View Homestay \u2014 a quality hotel in Totu offering comfortable stays.",
    "basePrice": 1800,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 75,
    "name": "Apple Orchard Homestay",
    "location": {
      "city": "Mashobra",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mashobra, Shimla"
    },
    "area": "Mashobra",
    "category": "budget",
    "starRating": 4,
    "description": "Apple Orchard Homestay \u2014 a quality hotel in Mashobra offering comfortable stays.",
    "basePrice": 2400,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 76,
    "name": "Fairmount Hotel",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Fairmount Hotel \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 4800,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 77,
    "name": "Chapslee Hotel",
    "location": {
      "city": "Lakkar Bazaar",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Lakkar Bazaar, Shimla"
    },
    "area": "Lakkar Bazaar",
    "category": "premium",
    "starRating": 4,
    "description": "Chapslee Hotel \u2014 a quality hotel in Lakkar Bazaar offering comfortable stays.",
    "basePrice": 9500,
    "rating": 4.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 78,
    "name": "Auckland Hotel",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Auckland Hotel \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 4200,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 79,
    "name": "Hotel Diplomat",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Diplomat \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 3800,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 80,
    "name": "Hotel Le Royale",
    "location": {
      "city": "Bharari",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Bharari, Shimla"
    },
    "area": "Bharari",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Le Royale \u2014 a quality hotel in Bharari offering comfortable stays.",
    "basePrice": 4500,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 81,
    "name": "Hotel Kapil",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Kapil \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 82,
    "name": "Hotel Chaman Palace",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Chaman Palace \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 83,
    "name": "Hotel White",
    "location": {
      "city": "Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel White \u2014 a quality hotel in Mall Road offering comfortable stays.",
    "basePrice": 2600,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 84,
    "name": "Hotel Rajat",
    "location": {
      "city": "The Mall",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Rajat \u2014 a quality hotel in The Mall offering comfortable stays.",
    "basePrice": 2400,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 85,
    "name": "Hotel Surya",
    "location": {
      "city": "Near Railway Station",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Railway Station, Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Surya \u2014 a quality hotel in Near Railway Station offering comfortable stays.",
    "basePrice": 2200,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 86,
    "name": "Hotel Monal",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Monal \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 3000,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 87,
    "name": "Hotel Mountain Face",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Mountain Face \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3400,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 88,
    "name": "Hotel Dreamland",
    "location": {
      "city": "Near Bus Stand",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Bus Stand, Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Dreamland \u2014 a quality hotel in Near Bus Stand offering comfortable stays.",
    "basePrice": 2000,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 89,
    "name": "Hotel Paradise",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Paradise \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 90,
    "name": "Hotel Sunrise",
    "location": {
      "city": "Near Railway Station",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Railway Station, Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Sunrise \u2014 a quality hotel in Near Railway Station offering comfortable stays.",
    "basePrice": 1800,
    "rating": 3.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 91,
    "name": "Hotel Valley View",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Valley View \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 92,
    "name": "Hotel Green Valley",
    "location": {
      "city": "Near Green Valley",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Green Valley, Shimla"
    },
    "area": "Green Valley",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Green Valley \u2014 a quality hotel in Near Green Valley offering comfortable stays.",
    "basePrice": 3600,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 93,
    "name": "Hotel Pine View",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Pine View \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 3000,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 94,
    "name": "Hotel Snow View",
    "location": {
      "city": "Near Kufri",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Kufri, Shimla"
    },
    "area": "Kufri",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Snow View \u2014 a quality hotel in Near Kufri offering comfortable stays.",
    "basePrice": 3400,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 95,
    "name": "Hotel Royal",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Royal \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2600,
    "rating": 3.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 96,
    "name": "Hotel Crown",
    "location": {
      "city": "Near Bus Stand",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Bus Stand, Shimla"
    },
    "area": "Shimla",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Crown \u2014 a quality hotel in Near Bus Stand offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 97,
    "name": "Hotel Grand",
    "location": {
      "city": "Near Railway Station",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Railway Station, Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 3,
    "description": "Hotel Grand \u2014 a quality hotel in Near Railway Station offering comfortable stays.",
    "basePrice": 2800,
    "rating": 3.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 98,
    "name": "Hotel Shimla View",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Shimla View \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 3400,
    "rating": 3.7,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 99,
    "name": "Hotel Hill Queen",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Hill Queen \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3000,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 100,
    "name": "Hotel Mountain Palace",
    "location": {
      "city": "Near Kufri",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Kufri, Shimla"
    },
    "area": "Kufri",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Mountain Palace \u2014 a quality hotel in Near Kufri offering comfortable stays.",
    "basePrice": 3800,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 101,
    "name": "Hotel Woodpark",
    "location": {
      "city": "Woodrina Estate",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Woodrina Estate, Dhalli, Shimla"
    },
    "area": "Dhalli",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Woodpark \u2014 a quality hotel in Woodrina Estate offering comfortable stays.",
    "basePrice": 4800,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 102,
    "name": "Hotel Woodrina",
    "location": {
      "city": "Dhalli",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Dhalli, Shimla"
    },
    "area": "Dhalli",
    "category": "premium",
    "starRating": 4,
    "description": "Hotel Woodrina \u2014 a quality hotel in Dhalli offering comfortable stays.",
    "basePrice": 5200,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 103,
    "name": "Camp Potters Hill",
    "location": {
      "city": "Van Vihar",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Van Vihar, Summer Hill, Shimla"
    },
    "area": "Summer Hill",
    "category": "mid-range",
    "starRating": 3,
    "description": "Camp Potters Hill \u2014 a quality hotel in Van Vihar offering comfortable stays.",
    "basePrice": 3500,
    "rating": 3.8,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 104,
    "name": "Shimla Havens Resort by Eco Hospitality",
    "location": {
      "city": "Hiranagar",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Hiranagar, Near Summer Hill, Shimla"
    },
    "area": "Summer Hill",
    "category": "premium",
    "starRating": 4,
    "description": "Shimla Havens Resort by Eco Hospitality \u2014 a quality hotel in Hiranagar offering comfortable stays.",
    "basePrice": 6800,
    "rating": 4.4,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 105,
    "name": "Treebo Premium Bridge View Regency",
    "location": {
      "city": "Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mall Road, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Treebo Premium Bridge View Regency \u2014 a quality hotel in Mall Road offering comfortable stays.",
    "basePrice": 4200,
    "rating": 4.1,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 106,
    "name": "Radisson Hotel Kufri Shimla",
    "location": {
      "city": "Kufri Fagu Highway",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kufri Fagu Highway, Kufri"
    },
    "area": "Kufri",
    "category": "premium",
    "starRating": 4,
    "description": "Radisson Hotel Kufri Shimla \u2014 a quality hotel in Kufri Fagu Highway offering comfortable stays.",
    "basePrice": 8500,
    "rating": 4.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 107,
    "name": "Hotel Silverine",
    "location": {
      "city": "Near Himachal Pradesh High Court",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Himachal Pradesh High Court, Below Shimla Club, The Mall, Shimla"
    },
    "area": "Mall Road Area",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Silverine \u2014 a quality hotel in Near Himachal Pradesh High Court offering comfortable stays.",
    "basePrice": 3800,
    "rating": 4.0,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 108,
    "name": "Hotel Taj Palace By Kalra Hospitality",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 3,
    "description": "Hotel Taj Palace By Kalra Hospitality \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3200,
    "rating": 3.9,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 109,
    "name": "Northern View Howard",
    "location": {
      "city": "Near Mall Road",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Mall Road, Below Kali Badi Temple, Fingask Estate, Shimla"
    },
    "area": "Fingask",
    "category": "budget",
    "starRating": 3,
    "description": "Northern View Howard \u2014 a quality hotel in Near Mall Road offering comfortable stays.",
    "basePrice": 2400,
    "rating": 3.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 110,
    "name": "Hotel Beejlees Regency",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "mid-range",
    "starRating": 4,
    "description": "Hotel Beejlees Regency \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 4500,
    "rating": 4.2,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 111,
    "name": "Hotel Haven Resort",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "premium",
    "starRating": 4,
    "description": "Hotel Haven Resort \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 5200,
    "rating": 4.3,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 112,
    "name": "Ballyhack Cottage - Am\u00e3 Stays & Trails",
    "location": {
      "city": "Lakkar Bazar",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Lakkar Bazar, Shimla"
    },
    "area": "Lakkar Bazaar",
    "category": "luxury",
    "starRating": 5,
    "description": "Ballyhack Cottage - Am\u00e3 Stays & Trails \u2014 a quality hotel in Lakkar Bazar offering comfortable stays.",
    "basePrice": 12000,
    "rating": 4.7,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 113,
    "name": "Raman Villa - Am\u00e3 Stays & Trails",
    "location": {
      "city": "Kelston",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Kelston, Shimla"
    },
    "area": "Shimla",
    "category": "luxury",
    "starRating": 4,
    "description": "Raman Villa - Am\u00e3 Stays & Trails \u2014 a quality hotel in Kelston offering comfortable stays.",
    "basePrice": 11000,
    "rating": 4.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 114,
    "name": "The Retreat Mashobra",
    "location": {
      "city": "Mashobra",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Mashobra, Shimla"
    },
    "area": "Mashobra",
    "category": "premium",
    "starRating": 4,
    "description": "The Retreat Mashobra \u2014 a quality hotel in Mashobra offering comfortable stays.",
    "basePrice": 7500,
    "rating": 4.5,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 115,
    "name": "Him Holidays Inn",
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Shimla"
    },
    "area": "Shimla",
    "category": "budget",
    "starRating": 5,
    "description": "Him Holidays Inn \u2014 a quality hotel in Shimla offering comfortable stays.",
    "basePrice": 2800,
    "rating": 4.8,
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 116,
    "name": "Flyer Exotica",
    "location": {
      "city": "Near Victory Tunnel",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Near Victory Tunnel, Shimla"
    },
    "area": "Victory Tunnel",
    "category": "mid-range",
    "starRating": 4,
    "description": "Flyer Exotica \u2014 a quality hotel in Near Victory Tunnel offering comfortable stays.",
    "basePrice": 3200,
    "rating": 4.6,
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 117,
    "name": "Vatsalyam Home Stay",
    "location": {
      "city": "Ragyan",
      "state": "Himachal Pradesh",
      "country": "India",
      "address": "Ragyan, Lower Dudhli, Po Bharari, Shimla"
    },
    "area": "Bharari",
    "category": "budget",
    "starRating": 5,
    "description": "Vatsalyam Home Stay \u2014 a quality hotel in Ragyan offering comfortable stays.",
    "basePrice": 2600,
    "rating": 4.7,
    "isActive": true,
    "isFeatured": true
  }
];
const PACKAGES = [
  {
    "staticId": 1,
    "title": "Shimla Manali Family Extravaganza",
    "category": "Family",
    "duration": "6 Days / 5 Nights",
    "price": 18500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Manali Family Extravaganza \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 2,
    "title": "Naldehra Golf & Nature Retreat",
    "category": "Family",
    "duration": "4 Days / 3 Nights",
    "price": 14200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Naldehra Golf & Nature Retreat \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 3,
    "title": "Grand Himachal Family Circuit",
    "category": "Family",
    "duration": "8 Days / 7 Nights",
    "price": 28500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Grand Himachal Family Circuit \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 4,
    "title": "Shimla Heritage Family Stay",
    "category": "Family",
    "duration": "5 Days / 4 Nights",
    "price": 16800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Heritage Family Stay \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 5,
    "title": "Himalayan Trekking Expedition",
    "category": "Adventure Sports",
    "duration": "4 Days / 3 Nights",
    "price": 15600,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Himalayan Trekking Expedition \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": true
  },
  {
    "staticId": 6,
    "title": "Kufri Snow Adventure Camp",
    "category": "Adventure Sports",
    "duration": "3 Days / 2 Nights",
    "price": 13200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Kufri Snow Adventure Camp \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 7,
    "title": "Manali-Shimla Adventure Circuit",
    "category": "Adventure Sports",
    "duration": "7 Days / 6 Nights",
    "price": 24500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Manali-Shimla Adventure Circuit \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 8,
    "title": "Mountain Biking & Climbing Challenge",
    "category": "Adventure Sports",
    "duration": "5 Days / 4 Nights",
    "price": 18900,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Mountain Biking & Climbing Challenge \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 9,
    "title": "Winter Skiing Masterclass",
    "category": "Adventure Sports",
    "duration": "4 Days / 3 Nights",
    "price": 19500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Winter Skiing Masterclass \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 10,
    "title": "Shimla Budget Explorer",
    "category": "Budget",
    "duration": "3 Days / 2 Nights",
    "price": 5500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Budget Explorer \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 11,
    "title": "Chail Budget Getaway",
    "category": "Budget",
    "duration": "2 Days / 1 Night",
    "price": 4200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Chail Budget Getaway \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 12,
    "title": "Hill Station Hopper Budget",
    "category": "Budget",
    "duration": "5 Days / 4 Nights",
    "price": 9500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Hill Station Hopper Budget \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 13,
    "title": "Student Special Shimla",
    "category": "Budget",
    "duration": "4 Days / 3 Nights",
    "price": 7800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Student Special Shimla \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 14,
    "title": "Romantic Shimla Honeymoon Special",
    "category": "Honeymoon",
    "duration": "5 Days / 4 Nights",
    "price": 24500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Romantic Shimla Honeymoon Special \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 15,
    "title": "Mashobra Honeymoon Hideaway",
    "category": "Honeymoon",
    "duration": "4 Days / 3 Nights",
    "price": 21500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Mashobra Honeymoon Hideaway \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 16,
    "title": "Shimla-Manali Honeymoon Bliss",
    "category": "Honeymoon",
    "duration": "7 Days / 6 Nights",
    "price": 32500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla-Manali Honeymoon Bliss \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 17,
    "title": "Luxury Honeymoon Suite Experience",
    "category": "Honeymoon",
    "duration": "3 Days / 2 Nights",
    "price": 18500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Luxury Honeymoon Suite Experience \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 18,
    "title": "Apple Orchard Honeymoon",
    "category": "Honeymoon",
    "duration": "4 Days / 3 Nights",
    "price": 19800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Apple Orchard Honeymoon \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 19,
    "title": "Oberoi Wildflower Hall Heritage",
    "category": "Luxury",
    "duration": "5 Days / 4 Nights",
    "price": 85000,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Oberoi Wildflower Hall Heritage \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 20,
    "title": "Royal Luxury Shimla Experience",
    "category": "Luxury",
    "duration": "4 Days / 3 Nights",
    "price": 52000,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Royal Luxury Shimla Experience \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 21,
    "title": "Maharaja Luxury Trail",
    "category": "Luxury",
    "duration": "6 Days / 5 Nights",
    "price": 78000,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Maharaja Luxury Trail \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 22,
    "title": "Premium Luxury Escape",
    "category": "Luxury",
    "duration": "5 Days / 4 Nights",
    "price": 65000,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Premium Luxury Escape \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 23,
    "title": "Luxury Wellness Retreat",
    "category": "Luxury",
    "duration": "4 Days / 3 Nights",
    "price": 58000,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Luxury Wellness Retreat \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 24,
    "title": "Shimla Weekend Express",
    "category": "Weekend",
    "duration": "2 Days / 1 Night",
    "price": 6500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Weekend Express \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 25,
    "title": "Narkanda Weekend Ski Getaway",
    "category": "Weekend",
    "duration": "2 Days / 1 Night",
    "price": 7200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Narkanda Weekend Ski Getaway \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 26,
    "title": "Quick Shimla Highlights",
    "category": "Weekend",
    "duration": "2 Days / 1 Night",
    "price": 5800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Quick Shimla Highlights \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 27,
    "title": "Adventure Weekend Blast",
    "category": "Weekend",
    "duration": "3 Days / 2 Nights",
    "price": 11200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Adventure Weekend Blast \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 28,
    "title": "Shimla Spiritual Journey",
    "category": "Spiritual",
    "duration": "4 Days / 3 Nights",
    "price": 11200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Spiritual Journey \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 29,
    "title": "Kamru Fort Spiritual Trek",
    "category": "Spiritual",
    "duration": "3 Days / 2 Nights",
    "price": 8900,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Kamru Fort Spiritual Trek \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 30,
    "title": "Himalayan Spiritual Circuit",
    "category": "Spiritual",
    "duration": "6 Days / 5 Nights",
    "price": 16800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Himalayan Spiritual Circuit \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 31,
    "title": "Yoga & Meditation Himalayan Retreat",
    "category": "Spiritual",
    "duration": "5 Days / 4 Nights",
    "price": 14500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Yoga & Meditation Himalayan Retreat \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 32,
    "title": "Shimla Nature Trails Expedition",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "price": 14200,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Nature Trails Expedition \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 33,
    "title": "Tattapani Hot Springs & Nature",
    "category": "Nature",
    "duration": "3 Days / 2 Nights",
    "price": 9800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Tattapani Hot Springs & Nature \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 34,
    "title": "Himachal Wildlife Safari",
    "category": "Nature",
    "duration": "4 Days / 3 Nights",
    "price": 15800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Himachal Wildlife Safari \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 35,
    "title": "Himalayan Flora & Fauna Tour",
    "category": "Nature",
    "duration": "6 Days / 5 Nights",
    "price": 21500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Himalayan Flora & Fauna Tour \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 36,
    "title": "Corporate Team Outing Shimla",
    "category": "Corporate",
    "duration": "3 Days / 2 Nights",
    "price": 18500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Corporate Team Outing Shimla \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 37,
    "title": "Leadership Retreat Himalayas",
    "category": "Corporate",
    "duration": "4 Days / 3 Nights",
    "price": 28500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Leadership Retreat Himalayas \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 38,
    "title": "Corporate Offsite Quick",
    "category": "Corporate",
    "duration": "2 Days / 1 Night",
    "price": 12500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Corporate Offsite Quick \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 39,
    "title": "Corporate Incentive Luxury Tour",
    "category": "Corporate",
    "duration": "5 Days / 4 Nights",
    "price": 32500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Corporate Incentive Luxury Tour \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 40,
    "title": "Chandratal Lake High-Altitude Trek",
    "category": "Himalayan Trekking",
    "duration": "8 Days / 7 Nights",
    "price": 28500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Chandratal Lake High-Altitude Trek \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 41,
    "title": "Hampta Pass Crossover Trek",
    "category": "Himalayan Trekking",
    "duration": "5 Days / 4 Nights",
    "price": 18900,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Hampta Pass Crossover Trek \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 42,
    "title": "Solang Valley Extreme Adventure Combo",
    "category": "Adventure Sports",
    "duration": "3 Days / 2 Nights",
    "price": 16500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Solang Valley Extreme Adventure Combo \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 43,
    "title": "Beas River Rafting & Camping Expedition",
    "category": "Adventure Sports",
    "duration": "2 Days / 1 Night",
    "price": 8900,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Beas River Rafting & Camping Expedition \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 44,
    "title": "Shimla Rock Climbing & Zipline Park",
    "category": "Adventure Sports",
    "duration": "1 Day",
    "price": 4500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shimla Rock Climbing & Zipline Park \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 45,
    "title": "Authentic Himachali Dham & Food Trail",
    "category": "Himachali Cuisine",
    "duration": "3 Days / 2 Nights",
    "price": 12500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Authentic Himachali Dham & Food Trail \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 46,
    "title": "Shinrin-Yoku Forest Therapy Retreat",
    "category": "Forest Bathing & Wellness",
    "duration": "4 Days / 3 Nights",
    "price": 22500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Shinrin-Yoku Forest Therapy Retreat \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 47,
    "title": "Himalayan Wellness & Yoga Retreat",
    "category": "Forest Bathing & Wellness",
    "duration": "6 Days / 5 Nights",
    "price": 32500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Himalayan Wellness & Yoga Retreat \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 48,
    "title": "Kufri Skiing & Snowboarding Masterclass",
    "category": "Winter Sports",
    "duration": "4 Days / 3 Nights",
    "price": 21500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Kufri Skiing & Snowboarding Masterclass \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 49,
    "title": "Manali Winter Wonderland Adventure",
    "category": "Winter Sports",
    "duration": "5 Days / 4 Nights",
    "price": 28500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Manali Winter Wonderland Adventure \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 50,
    "title": "Manali-Jispa Himalayan Expedition",
    "category": "Himalayan Trekking",
    "duration": "6 Days / 5 Nights",
    "price": 24500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Manali-Jispa Himalayan Expedition \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 51,
    "title": "Kullu Valley Food Heritage Tour",
    "category": "Himachali Cuisine",
    "duration": "4 Days / 3 Nights",
    "price": 14500,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Kullu Valley Food Heritage Tour \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  },
  {
    "staticId": 52,
    "title": "Gulaba Snow Village Experience",
    "category": "Winter Sports",
    "duration": "3 Days / 2 Nights",
    "price": 16800,
    "location": {
      "city": "Shimla",
      "state": "Himachal Pradesh",
      "country": "India"
    },
    "description": "Experience Gulaba Snow Village Experience \u2014 an unforgettable Himachal Pradesh journey.",
    "isActive": true,
    "isFeatured": false
  }
];

async function seed() {
  const force = process.argv.includes('--force');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Use raw collection driver — bypasses ALL Mongoose schema/validation
    const hotelCol = mongoose.connection.collection('hotels');
    const pkgCol = mongoose.connection.collection('packages');

    // ── Hotels ──────────────────────────────────────────────────────────────
    const hotelCount = await hotelCol.countDocuments();
    if (hotelCount === 0 || force) {
      if (force && hotelCount > 0) {
        await hotelCol.deleteMany({});
        console.log('🗑  Cleared existing hotels');
      }
      const hotelDocs = HOTELS.map(h => ({
        ...h,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const result = await hotelCol.insertMany(hotelDocs, { ordered: false });
      console.log(`✅ Seeded ${result.insertedCount} hotels`);
    } else {
      console.log(`ℹ️  Hotels already seeded (${hotelCount}). Use --force to reseed.`);
    }

    // ── Packages ─────────────────────────────────────────────────────────────
    const pkgCount = await pkgCol.countDocuments();
    if (pkgCount === 0 || force) {
      if (force && pkgCount > 0) {
        await pkgCol.deleteMany({});
        console.log('🗑  Cleared existing packages');
      }
      const pkgDocs = PACKAGES.map(p => ({
        ...p,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const result = await pkgCol.insertMany(pkgDocs, { ordered: false });
      console.log(`✅ Seeded ${result.insertedCount} packages`);
    } else {
      console.log(`ℹ️  Packages already seeded (${pkgCount}). Use --force to reseed.`);
    }

    console.log('');
    console.log('🎉 Seed complete!');
    console.log(`   Hotels:   ${await hotelCol.countDocuments()}`);
    console.log(`   Packages: ${await pkgCol.countDocuments()}`);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (err.writeErrors) {
      console.error(`   Write errors: ${err.writeErrors.length}`);
      console.error('   First error:', err.writeErrors[0]?.errmsg || err.writeErrors[0]);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

seed();
