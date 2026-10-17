// Generates the clearly labelled demonstration dataset in data/demo/.
// Every gym, professional, price and offer here is fictional. Area names and coordinates are real
// places so distance search behaves realistically; no listing represents a real business.
// Run: node scripts/generate-demo-data.mjs
import { mkdir, writeFile } from 'node:fs/promises';

let seed = 20261017;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = list => list[Math.floor(rand() * list.length)];
const round50 = value => Math.round(value / 50) * 50;
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const cities = [
  { id: 'bengaluru', name: 'Bengaluru', region: 'Karnataka', country: 'India', currency: 'INR', lat: 12.9716, lng: 77.5946, areas: [
    { name: 'Indiranagar', lat: 12.9784, lng: 77.6408, postcodes: ['560038'] }, { name: 'Koramangala', lat: 12.9352, lng: 77.6245, postcodes: ['560034', '560095'] },
    { name: 'Whitefield', lat: 12.9698, lng: 77.75, postcodes: ['560066'] }, { name: 'Jayanagar', lat: 12.925, lng: 77.5938, postcodes: ['560041', '560011'] }] },
  { id: 'mumbai', name: 'Mumbai', region: 'Maharashtra', country: 'India', currency: 'INR', lat: 19.076, lng: 72.8777, areas: [
    { name: 'Bandra West', lat: 19.0596, lng: 72.8295, postcodes: ['400050'] }, { name: 'Andheri West', lat: 19.1364, lng: 72.8296, postcodes: ['400053', '400058'] },
    { name: 'Powai', lat: 19.1176, lng: 72.906, postcodes: ['400076'] }, { name: 'Lower Parel', lat: 18.998, lng: 72.8302, postcodes: ['400013'] }] },
  { id: 'delhi', name: 'New Delhi', region: 'Delhi', country: 'India', currency: 'INR', lat: 28.6139, lng: 77.209, areas: [
    { name: 'Saket', lat: 28.5245, lng: 77.2066, postcodes: ['110017'] }, { name: 'Vasant Kunj', lat: 28.52, lng: 77.159, postcodes: ['110070'] },
    { name: 'Dwarka', lat: 28.5921, lng: 77.046, postcodes: ['110075', '110078'] }, { name: 'Connaught Place', lat: 28.6315, lng: 77.2167, postcodes: ['110001'] }] },
  { id: 'hyderabad', name: 'Hyderabad', region: 'Telangana', country: 'India', currency: 'INR', lat: 17.385, lng: 78.4867, areas: [
    { name: 'Banjara Hills', lat: 17.4156, lng: 78.4347, postcodes: ['500034'] }, { name: 'Gachibowli', lat: 17.4401, lng: 78.3489, postcodes: ['500032'] },
    { name: 'Madhapur', lat: 17.4483, lng: 78.3915, postcodes: ['500081'] }, { name: 'Kondapur', lat: 17.46, lng: 78.36, postcodes: ['500084'] }] },
];

const img = (photo, alt) => ({ src: `/web/media/exercises/${photo}-0.webp`, alt, caption: 'Representative image from Free Exercise DB (public domain). Not a photo of this gym.' });
const IMAGES = {
  strength: [img('Barbell_Deadlift', 'Lifter setting up a barbell deadlift on a lifting platform'), img('Barbell_Squat', 'Squat rack with a loaded barbell'), img('Bent_Over_Barbell_Row', 'Barbell row in front of a power rack'), img('Barbell_Bench_Press_-_Medium_Grip', 'Bench press station')],
  'full-service': [img('Walking_Treadmill', 'Row of treadmills in a cardio area'), img('Wide-Grip_Lat_Pulldown', 'Cable and pulldown machines'), img('Leg_Press', 'Leg press machine'), img('Seated_Cable_Rows', 'Seated cable row station')],
  boutique: [img('Band_Pull_Apart', 'Open functional training floor'), img('Incline_Push-Up', 'Plyometric boxes on a training floor'), img('Dead_Bug', 'Floor exercise in a dark studio'), img('Close-Grip_Push-Up_off_of_a_Dumbbell', 'Dumbbell rack in a dark studio')],
  family: [img('Lateral_Cone_Hops', 'Agility cones laid out on a sports floor'), img('Fast_Skipping', 'Open indoor floor for running drills'), img('Mountain_Climbers', 'Bright training studio'), img('Bodyweight_Walking_Lunge', 'Gym floor with space for movement drills')],
  wellness: [img('Walking_Treadmill', 'Treadmills for steady walking'), img('Chair_Lower_Back_Stretch', 'Bright stretching area with natural light'), img('Step-up_with_Knee_Raise', 'Step-up platform in a gym'), img('Calf_Stretch_Hands_Against_Wall', 'Wall space for supported stretching')],
};

// Gyms of the same type in different cities lead with a different photo.
const rotate = (list, by) => list.map((_, i) => list[(i + by) % list.length]);
const TYPE_OF = new Map();

const DISCOUNT = { 1: 0, 2: 0.04, 3: 0.08, 6: 0.15, 9: 0.2, 10: 0.22, 12: 0.25 };
const termName = months => months === 1 ? 'Monthly' : months === 12 ? 'Annual' : `${months}-month`;

function plans({ base, durations, audiences, includes, classesIncluded, ptEvery, monthlyBillingFrom, joiningFee, deposit, label = '', offerOn }) {
  return durations.map(months => {
    const price = round50(base * months * (1 - DISCOUNT[months]));
    const offer = offerOn?.includes(months) ? { label: 'Demonstration offer: joining fee waived', validUntil: '2027-03-31', terms: 'Applies to new members who start before the end date. Demonstration data, not a real offer.' } : null;
    return {
      id: `${label ? slug(label) + '-' : ''}${months}m`, name: `${label ? label + ' · ' : ''}${termName(months)}`, months, price,
      billing: monthlyBillingFrom && months >= monthlyBillingFrom ? 'monthly' : 'upfront', joiningFee: offer ? 0 : joiningFee, deposit,
      includes, classesIncluded, ptSessions: ptEvery ? Math.floor(months / ptEvery) : 0, audiences,
      renewal: months === 1 ? 'Rolls monthly until cancelled.' : `Ends after ${months} months. You choose whether to renew.`,
      cancellation: months === 1 ? 'Cancel any time with 30 days’ notice.' : 'Non-refundable after the first 14 days, except for medical reasons with a doctor’s note.',
      offer,
    };
  });
}

const GYMS = {
  bengaluru: [
    { name: 'Forge Athletic Club', area: 'Indiranagar', type: 'strength', categories: ['strength'], audiences: ['adults'], base: 3500, facilities: ['free-weights', 'machines', 'cardio', 'functional', 'showers', 'lockers'], classes: ['Barbell technique', 'Strength foundations'], hours: ['5:00–23:00', '6:00–21:00', false, true, true], accessibility: ['step-free'], tagline: 'Platforms, racks and coaches who care about technique.' },
    { name: 'Meridian Health & Swim', area: 'Whitefield', type: 'full-service', categories: ['full-service'], audiences: ['adults', 'older'], base: 4800, facilities: ['free-weights', 'machines', 'cardio', 'pool', 'sauna', 'studio', 'showers', 'lockers', 'parking', 'cafe'], classes: ['Aqua fitness', 'Yoga', 'Pilates', 'Spin', 'Balance & mobility 60+'], hours: ['6:00–22:00', '7:00–20:00', false, false, false], accessibility: ['step-free', 'accessible-changing', 'lift', 'seated-equipment'], tagline: 'Pool, studios and a full gym under one roof.' },
    { name: 'Kinetic Yard', area: 'Koramangala', type: 'boutique', categories: ['boutique', 'crossfit-style'], audiences: ['adults'], base: 5200, facilities: ['functional', 'free-weights', 'studio', 'showers'], classes: ['Conditioning', 'Kettlebell', 'Mobility'], hours: ['6:00–21:00', '7:00–13:00', false, true, false], accessibility: [], tagline: 'Small-group conditioning with a coach at every session.' },
    { name: 'Little Strides Sports Centre', area: 'Jayanagar', type: 'family', categories: ['family', 'sports'], audiences: ['kids', 'adults'], base: 2600, kidsBase: 2200, facilities: ['sports-hall', 'studio', 'cardio', 'machines', 'showers', 'parking', 'childcare'], classes: ['Junior athletics (5–12)', 'Mini gymnastics (5–8)', 'Family fitness', 'Adult circuits'], hours: ['6:00–21:00', '8:00–18:00', false, true, false], accessibility: ['step-free', 'accessible-changing'], tagline: 'Supervised junior sports and a gym for parents.' },
  ],
  mumbai: [
    { name: 'Tidewater Strength Co.', area: 'Lower Parel', type: 'strength', categories: ['strength'], audiences: ['adults'], base: 4500, facilities: ['free-weights', 'machines', 'cardio', 'boxing', 'showers', 'lockers'], classes: ['Powerlifting basics', 'Boxing fitness'], hours: ['24 hours', '24 hours', true, true, true], accessibility: ['step-free', 'lift'], tagline: 'Open around the clock for serious strength training.' },
    { name: 'Halcyon Wellness Studio', area: 'Bandra West', type: 'wellness', categories: ['wellness', 'boutique'], audiences: ['adults', 'older'], base: 5500, facilities: ['studio', 'machines', 'cardio', 'sauna', 'showers', 'cafe'], classes: ['Pilates reformer', 'Gentle strength 60+', 'Yoga', 'Breathwork'], hours: ['7:00–21:00', '8:00–17:00', false, false, false], accessibility: ['step-free', 'accessible-changing', 'hearing-loop', 'seated-equipment'], tagline: 'Calm, unhurried training with small classes.' },
    { name: 'Northline Fitness Club', area: 'Andheri West', type: 'full-service', categories: ['full-service'], audiences: ['adults', 'older'], base: 3900, facilities: ['free-weights', 'machines', 'cardio', 'studio', 'pool', 'showers', 'lockers', 'parking'], classes: ['Spin', 'HIIT', 'Zumba', 'Swim technique'], hours: ['5:30–23:00', '6:00–22:00', false, true, true], accessibility: ['step-free', 'lift'], tagline: 'Everything in one place, with long opening hours.' },
    { name: 'Powai Junior Athletics', area: 'Powai', type: 'family', categories: ['family', 'sports'], audiences: ['kids'], kidsBase: 2400, facilities: ['sports-hall', 'studio', 'showers', 'parking'], classes: ['Football skills (6–12)', 'Athletics (8–12)', 'Movement & play (5–7)'], hours: ['15:30–20:00', '8:00–14:00', false, false, false], accessibility: ['step-free'], tagline: 'Coach-led sport for children, with checked coaches on every session.' },
  ],
  delhi: [
    { name: 'Atlas Performance Lab', area: 'Saket', type: 'strength', categories: ['strength', 'crossfit-style'], audiences: ['adults'], base: 4200, facilities: ['free-weights', 'functional', 'machines', 'cardio', 'showers', 'lockers', 'parking'], classes: ['Olympic lifting', 'Conditioning', 'Mobility'], hours: ['5:00–22:00', '6:00–20:00', false, true, false], accessibility: ['step-free'], tagline: 'Performance coaching for athletes and ambitious beginners.' },
    { name: 'Evergreen Active Living', area: 'Vasant Kunj', type: 'wellness', categories: ['wellness'], audiences: ['older', 'adults'], base: 3200, facilities: ['machines', 'cardio', 'studio', 'pool', 'showers', 'parking', 'cafe'], classes: ['Balance & falls prevention', 'Chair yoga', 'Aqua walking', 'Strength for life'], hours: ['7:00–19:00', '8:00–14:00', false, false, false], accessibility: ['step-free', 'accessible-changing', 'lift', 'hearing-loop', 'seated-equipment'], tagline: 'Supportive strength and balance training for later life.' },
    { name: 'Capital Fitness Commons', area: 'Connaught Place', type: 'full-service', categories: ['full-service'], audiences: ['adults'], base: 3800, facilities: ['free-weights', 'machines', 'cardio', 'studio', 'showers', 'lockers'], classes: ['Spin', 'Circuit', 'Core'], hours: ['6:00–22:30', '7:00–20:00', false, true, true], accessibility: ['lift'], tagline: 'A central gym for before, after and between work.' },
    { name: 'Dwarka Youth Sports Hub', area: 'Dwarka', type: 'family', categories: ['family', 'sports'], audiences: ['kids', 'adults'], base: 2300, kidsBase: 1900, facilities: ['sports-hall', 'cardio', 'machines', 'studio', 'showers', 'parking', 'childcare'], classes: ['Junior badminton (7–12)', 'Kids fitness games (5–9)', 'Parent & child yoga', 'Adult fitness'], hours: ['6:00–21:00', '7:00–19:00', false, true, false], accessibility: ['step-free'], tagline: 'Junior sports and family fitness close to home.' },
  ],
  hyderabad: [
    { name: 'Ironstone Barbell Club', area: 'Madhapur', type: 'strength', categories: ['strength'], audiences: ['adults'], base: 3300, facilities: ['free-weights', 'machines', 'cardio', 'showers', 'lockers'], classes: ['Strength foundations', 'Powerlifting'], hours: ['5:00–23:00', '6:00–22:00', false, true, true], accessibility: [], tagline: 'Racks, platforms and plenty of plates.' },
    { name: 'Summit & Spring Club', area: 'Banjara Hills', type: 'full-service', categories: ['full-service', 'wellness'], audiences: ['adults', 'older'], base: 5600, facilities: ['free-weights', 'machines', 'cardio', 'pool', 'sauna', 'studio', 'climbing', 'showers', 'lockers', 'parking', 'cafe'], classes: ['Climbing intro', 'Aqua fitness', 'Pilates', 'Active 65+ circuits'], hours: ['6:00–22:00', '7:00–21:00', false, true, false], accessibility: ['step-free', 'accessible-changing', 'lift', 'seated-equipment'], tagline: 'A premium club with pool, climbing wall and spa.' },
    { name: 'Gachibowli Movement Studio', area: 'Gachibowli', type: 'boutique', categories: ['boutique'], audiences: ['adults'], base: 4600, facilities: ['studio', 'functional', 'free-weights', 'showers'], classes: ['Strength & sculpt', 'Mobility flow', 'HIIT'], hours: ['6:00–21:00', '7:00–12:00', false, true, false], accessibility: ['step-free'], tagline: 'Coached small-group sessions near the tech corridor.' },
    { name: 'Kondapur Kids & Family Sports', area: 'Kondapur', type: 'family', categories: ['family', 'sports'], audiences: ['kids', 'adults', 'older'], base: 2400, kidsBase: 2000, facilities: ['sports-hall', 'pool', 'cardio', 'machines', 'studio', 'showers', 'parking', 'childcare'], classes: ['Learn to swim (5–12)', 'Junior multisport (6–12)', 'Family swim', 'Gentle fitness'], hours: ['6:00–21:00', '7:00–19:00', false, true, false], accessibility: ['step-free', 'accessible-changing'], tagline: 'Swimming and multisport for the whole family.' },
  ],
};

const EQUIPMENT = {
  strength: ['Power racks and platforms', 'Barbells and bumper plates', 'Dumbbells to 50 kg', 'Cable stations', 'Benches', 'Rowers and air bikes'],
  'full-service': ['Treadmills, bikes and cross-trainers', 'Selectorised machines', 'Dumbbells to 40 kg', 'Cable stations', 'Smith machine', 'Stretching area'],
  boutique: ['Kettlebells', 'Dumbbells', 'Plyometric boxes', 'Rowers and ski-ergs', 'Sleds', 'Resistance bands'],
  family: ['Sports hall with markings', 'Junior-safe equipment', 'Cardio machines', 'Selectorised machines', 'Mats and soft play', 'Cones, balls and agility kit'],
  wellness: ['Seated and assisted machines', 'Recumbent bikes', 'Treadmills with handrails', 'Light dumbbells', 'Balance equipment', 'Reformer beds'],
};

const gyms = [];
for (const [cityIndex, city] of cities.entries()) {
  for (const def of GYMS[city.id]) {
    const area = city.areas.find(item => item.name === def.area);
    const id = slug(def.name);
    TYPE_OF.set(id, def.type);
    const adultPlans = def.base ? plans({ base: def.base, durations: def.type === 'boutique' ? [1, 3, 6, 10] : [1, 2, 3, 6, 9, 10, 12], audiences: def.audiences.filter(a => a !== 'kids'),
      includes: ['Gym floor access', ...(def.facilities.includes('pool') ? ['Pool access'] : []), ...(def.classes.length && def.type !== 'strength' ? ['Group classes'] : [])], classesIncluded: def.type !== 'strength' && def.classes.length > 0,
      ptEvery: def.type === 'boutique' ? 3 : def.type === 'strength' ? 6 : 0, monthlyBillingFrom: def.type === 'full-service' ? 6 : null, joiningFee: def.type === 'boutique' ? 0 : round50(def.base * 0.3),
      deposit: def.facilities.includes('lockers') ? 500 : 0, offerOn: rand() > 0.5 ? [6, 10] : [3] }) : [];
    const kidsPlans = def.kidsBase ? plans({ base: def.kidsBase, durations: [1, 3, 6, 10], audiences: ['kids'], label: 'Junior', includes: ['Supervised junior sessions', 'Coach-to-child ratio of 1:8 or better'],
      classesIncluded: true, ptEvery: 0, monthlyBillingFrom: null, joiningFee: 0, deposit: 0 }) : [];
    const olderPlans = def.audiences.includes('older') && def.type === 'wellness' ? plans({ base: Math.round(def.base * 0.8), durations: [1, 3, 6, 10], audiences: ['older'], label: 'Active 65+',
      includes: ['Gym floor access off-peak', 'Balance & mobility classes', 'Initial movement assessment'], classesIncluded: true, ptEvery: 3, monthlyBillingFrom: null, joiningFee: 0, deposit: 0 }) : [];
    gyms.push({
      id, demo: true, name: def.name, tagline: def.tagline,
      description: `${def.name} is a demonstration listing in ${def.area}, ${city.name}. It shows how a real ${def.categories.map(c => c.replace('-', ' ')).join(' and ')} venue would appear on Icarus: facilities, membership terms and services, all clearly priced.`,
      cityId: city.id, area: def.area, address: `Demonstration listing · ${def.area}, ${city.name}`,
      lat: Math.round((area.lat + (rand() - 0.5) * 0.012) * 10000) / 10000, lng: Math.round((area.lng + (rand() - 0.5) * 0.012) * 10000) / 10000,
      categories: def.categories, facilities: def.facilities, equipment: EQUIPMENT[def.type], classes: def.classes,
      hours: { weekdays: def.hours[0], weekends: def.hours[1], open24h: def.hours[2], earlyOpen: def.hours[3], lateClose: def.hours[4] },
      audiences: def.audiences, accessibility: def.accessibility, images: rotate(IMAGES[def.type], cityIndex), currency: city.currency,
      memberships: [...adultPlans, ...olderPlans, ...kidsPlans], trainerIds: [], nutritionistIds: [],
      policies: {
        cancellation: 'Monthly plans: 30 days’ notice. Fixed terms: refundable within 14 days of purchase, then only for medical reasons.',
        renewal: 'Fixed-term plans do not renew automatically. Monthly plans continue until cancelled.',
        fees: 'Joining fees and deposits are shown on each plan. No other mandatory charges.',
        eligibility: def.audiences.includes('kids') ? 'Junior members must be accompanied to and from sessions by a parent or guardian.' : 'Members must be 18 or over. A short health questionnaire is completed at induction.',
        guardian: def.audiences.includes('kids') ? 'A parent or guardian signs up, gives consent and is the contact for all junior bookings.' : null,
      },
      reviews: null, contact: { method: 'enquiry', phone: null, email: null, website: null },
    });
  }
}

const FIRST = ['Aarav', 'Meera', 'Kabir', 'Ananya', 'Rohan', 'Isha', 'Vikram', 'Nisha', 'Arjun', 'Tara', 'Dev', 'Kavya', 'Sameer', 'Leela', 'Imran', 'Priya', 'Neel', 'Radhika', 'Farhan', 'Sanya'];
const LAST = ['Rao', 'Iyer', 'Kapoor', 'Menon', 'Shah', 'Nair', 'Bose', 'Khanna', 'Reddy', 'Desai', 'Sethi', 'Pillai', 'Varma', 'Joshi', 'Qureshi', 'Malhotra', 'Gill', 'Sen', 'Ahmed', 'Kulkarni'];
const TRAINER_TYPES = [
  { specialties: ['Strength training', 'Muscle building', 'Technique coaching'], audiences: ['adults'], quals: ['Certified Personal Trainer (Level 3)', 'Strength and conditioning certificate'], gymType: 'strength' },
  { specialties: ['Youth sport', 'Coordination and agility', 'Fun fitness for children'], audiences: ['kids'], quals: ['Youth sports coaching certificate', 'Child safeguarding training', 'Paediatric first aid'], gymType: 'family' },
  { specialties: ['Strength and balance for older adults', 'Falls prevention', 'Mobility'], audiences: ['older', 'adults'], quals: ['Exercise for older adults certificate', 'Certified Personal Trainer (Level 3)', 'First aid'], gymType: 'wellness' },
];
const NUTRI_TYPES = [
  { specialties: ['Sports nutrition', 'Body composition', 'Meal planning'], audiences: ['adults'], quals: ['Registered Dietitian', 'Sports nutrition diploma'] },
  { specialties: ['Family nutrition', 'Healthy eating for children', 'Nutrition in later life'], audiences: ['kids', 'adults', 'older'], quals: ['Registered Dietitian', 'Paediatric nutrition course'] },
];
const professionals = [];
let n = 0;
for (const city of cities) {
  const cityGyms = gyms.filter(gym => gym.cityId === city.id);
  for (const type of TRAINER_TYPES) {
    const name = `${FIRST[n % 20]} ${LAST[(n * 7) % 20]}`; n++;
    const homeGyms = cityGyms.filter(gym => gym.audiences.some(a => type.audiences.includes(a)) && (TYPE_OF.get(gym.id) === type.gymType || rand() > 0.6)).slice(0, 2);
    const p = { id: slug(name), demo: true, role: 'trainer', name, initials: name.split(' ').map(part => part[0]).join(''), cityId: city.id, areas: [...new Set(homeGyms.map(g => g.area))],
      gymIds: homeGyms.map(g => g.id), formats: type.audiences.includes('kids') ? ['in-person'] : ['in-person', 'online', 'hybrid'], specialties: type.specialties, audiences: type.audiences,
      experienceYears: 3 + Math.floor(rand() * 12), qualifications: type.quals.map(q => ({ name: q, issuer: 'Not yet verified', verified: false })), languages: ['English', pick(['Hindi', 'Kannada', 'Marathi', 'Telugu', 'Tamil'])],
      bio: `Demonstration profile. ${name} represents how a ${type.specialties[0].toLowerCase()} coach would present their experience, specialties and availability on Icarus.`,
      rate: round50(900 + rand() * 900), mealPlanFee: null, currency: city.currency, availability: 'Request a time; the coach replies with available slots.' };
    professionals.push(p);
    for (const gym of homeGyms) gym.trainerIds.push(p.id);
  }
  for (const type of NUTRI_TYPES) {
    const name = `${FIRST[n % 20]} ${LAST[(n * 7) % 20]}`; n++;
    const p = { id: slug(name), demo: true, role: 'nutritionist', name, initials: name.split(' ').map(part => part[0]).join(''), cityId: city.id, areas: city.areas.slice(0, 2).map(a => a.name),
      gymIds: cityGyms.filter(g => g.audiences.some(a => type.audiences.includes(a))).slice(0, 2).map(g => g.id), formats: ['in-person', 'online', 'hybrid'], specialties: type.specialties, audiences: type.audiences,
      experienceYears: 4 + Math.floor(rand() * 10), qualifications: type.quals.map(q => ({ name: q, issuer: 'Not yet verified', verified: false })), languages: ['English', pick(['Hindi', 'Kannada', 'Marathi', 'Telugu', 'Bengali'])],
      bio: `Demonstration profile. ${name} represents how a nutrition professional focused on ${type.specialties[0].toLowerCase()} would present their services on Icarus.`,
      rate: round50(1200 + rand() * 1200), mealPlanFee: type.audiences.includes('kids') ? null : round50(1500 + rand() * 1000), currency: city.currency, availability: 'Online consultations most weekdays; in-person by request.' };
    professionals.push(p);
    for (const gymId of p.gymIds) gyms.find(g => g.id === gymId).nutritionistIds.push(p.id);
  }
}

const packages = [
  { id: 'fitness-essentials', name: 'Fitness Essentials', summary: 'A coached start: technique, a simple plan and practical eating habits.', weeks: 4, trainingSessions: 8, nutritionConsults: 2, mealPlanning: false,
    assessments: 'Movement assessment in week 1', followUps: 'Check-in after week 2 and a review in week 4', formats: ['in-person', 'online', 'hybrid'], audiences: ['adults', 'older'],
    includes: ['Personal programme', 'Technique coaching', 'Two nutrition consultations', 'Shared goals between your trainer and nutritionist'] },
  { id: 'strength-performance', name: 'Strength & Performance', summary: 'Progressive strength training with nutrition to support it.', weeks: 8, trainingSessions: 16, nutritionConsults: 3, mealPlanning: true,
    assessments: 'Strength baseline in week 1, retest in week 8', followUps: 'Fortnightly nutrition check-ins', formats: ['in-person', 'hybrid'], audiences: ['adults'],
    includes: ['Periodised strength plan', 'Twice-weekly coached sessions', 'Performance-focused meal plan', 'Joint progress reviews'] },
  { id: 'complete-transformation', name: 'Complete Transformation', summary: 'Twelve weeks of coordinated training and nutrition for a major change.', weeks: 12, trainingSessions: 24, nutritionConsults: 6, mealPlanning: true,
    assessments: 'Assessments in weeks 1, 6 and 12', followUps: 'Fortnightly consultations and weekly messages', formats: ['in-person', 'online', 'hybrid'], audiences: ['adults'],
    includes: ['Training and nutrition plans built together', 'Meal planning', 'Habit coaching', 'Three joint reviews'] },
  { id: 'premium-coaching', name: 'Premium Personal Coaching', summary: 'Three sessions a week and close nutrition support.', weeks: 12, trainingSessions: 36, nutritionConsults: 8, mealPlanning: true,
    assessments: 'Monthly assessments', followUps: 'Weekly check-ins with both professionals', formats: ['in-person', 'hybrid'], audiences: ['adults'],
    includes: ['Three sessions every week', 'Weekly nutrition check-ins', 'Meal planning', 'Priority scheduling'] },
  { id: 'young-athlete', name: 'Young Athlete Foundations', summary: 'Supervised movement skills, coordination and sport for children.', weeks: 8, trainingSessions: 8, nutritionConsults: 0, mealPlanning: false,
    assessments: 'Fun movement skills check in week 1', followUps: 'Update for parents after week 4 and week 8', formats: ['in-person'], audiences: ['kids'],
    includes: ['Weekly coached session with a checked youth coach', 'A parent or guardian attends or stays on site', 'Progress notes for parents'] },
  { id: 'active-ageing', name: 'Active Ageing', summary: 'Strength, balance and confidence, with nutrition advice for later life.', weeks: 8, trainingSessions: 12, nutritionConsults: 2, mealPlanning: false,
    assessments: 'Balance and strength assessment in weeks 1 and 8', followUps: 'Check-in every two weeks', formats: ['in-person', 'hybrid'], audiences: ['older'],
    includes: ['Supported strength and balance sessions', 'Falls-prevention exercises', 'Two nutrition consultations', 'Plans shared with your doctor if you wish'] },
];

await mkdir('data/demo', { recursive: true });
const meta = { notice: 'Demonstration data. Every gym, professional, price and offer is fictional and must be labelled as such in the interface.', generated: 'scripts/generate-demo-data.mjs' };
for (const [name, items] of Object.entries({ cities, gyms, professionals, packages })) await writeFile(`data/demo/${name}.json`, JSON.stringify({ ...meta, items }, null, 2) + '\n');
console.log(`Wrote ${cities.length} cities, ${gyms.length} gyms, ${professionals.length} professionals, ${packages.length} packages.`);
