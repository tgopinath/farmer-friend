// Google sign-in (required) and profile, shared with Gopinath's other apps: see kolam-design-system/auth.
import { KolamAuth } from 'https://tgopinath.github.io/kolam-design-system/auth/kolam-auth.js'
KolamAuth.init({
  app: 'farmerfriend', appName: 'FarmerFriend', icon: 'icon-192.png',
  tagline: 'Save your place, field and crop choices to your account, so they follow you between your phone and the web.',
  fields: [
    { key: 'village', label: 'Village or district', placeholder: 'e.g. Thanjavur' },
    { key: 'fieldSize', label: 'Field size (acres)', type: 'number' },
    { key: 'lang', label: 'Language', type: 'select', options: [['en', 'English'], ['ta', 'தமிழ்']] },
  ],
  avatarSlot: '.topbar',
  sync: ['ff.place', 'ff.area', 'ff.lang', 'ff.orgType', 'ff.cropFilter', 'ff.calCat', 'ff.calSort'],
})
