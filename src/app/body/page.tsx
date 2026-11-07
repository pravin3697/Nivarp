'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { idbGet, idbSet } from '@/lib/storage';
import { NivarpLogo } from '@/components/ui/NivarpLogo';
import { 
  ArrowLeft, 
  Dumbbell, 
  Flame, 
  Utensils, 
  Play, 
  RotateCcw, 
  Check, 
  Plus, 
  ShieldCheck, 
  AlertCircle,
  Timer,
  Zap,
  Activity,
  Cookie,
  Trash2,
  Clock,
  ExternalLink,
  Pencil,
  ChevronDown,
  BookOpen
} from 'lucide-react';

const BODY_LOG_KEY = 'NIVARP_BODY_DAILY_LOG';
const CUSTOM_VIDEOS_KEY = 'NIVARP_CUSTOM_EXERCISE_VIDEOS';

interface FoodEntry {
  id: string;
  time: string;
  name: string;
  qty: string;
  estProtein: number;
  isJunkLeak: boolean;
}

interface DailyLog {
  date: string;
  pushups: number;
  squats: number;
  vacuumsDone: number;
  biscuitCount: number;
  foodEntries: FoodEntry[];
  notes: string;
}

interface VillageFoodRecipe {
  name: string;
  protein: string;
  target: string;
  why: string;
  prepTime: string;
  ingredients: string[];
  steps: string[];
  proTip: string;
}

const VILLAGE_FOODS: VillageFoodRecipe[] = [
  {
    name: 'Spicy Soya Chunks Sukka (Meal Maker)',
    protein: '52g per 100g (26g per serving)',
    target: '50g dry chunks daily',
    why: 'Cheapest protein powerhouse in India (₹10 per packet). Squeezing water makes it taste just like mutton/chicken sukka. Zero sugar.',
    prepTime: '7 Minutes',
    ingredients: [
      '50g Soya Chunks (Meal Maker)',
      '1 Onion & 1 Tomato (chopped)',
      '3 Crushed Garlic Cloves & 1 Green Chili',
      'Curry leaves, Turmeric, Chili Powder, Salt, 1 tsp Oil'
    ],
    steps: [
      '1. Boil soya chunks in salted water for 5 minutes until fully puffed up.',
      '2. Drain and wash with cold water. Squeeze out 100% of the water with your hands (critical so it absorbs masala and does not taste spongy).',
      '3. In a kadai/pan, heat 1 tsp oil, add curry leaves, crushed garlic, green chili, and onions. Sauté until golden.',
      '4. Add chopped tomatoes, turmeric, 1/2 tsp chili powder, and salt. Cook until mushy.',
      '5. Toss in the squeezed soya chunks on high heat for 3-4 minutes until dry and coated.'
    ],
    proTip: 'Squeezing out all the water before tossing is the #1 secret to making soya chunks taste like real meat.'
  },
  {
    name: 'Pepper Boiled Eggs / Village Shallot Omelette',
    protein: '6g per egg (18g - 24g per serving)',
    target: '3 to 5 Eggs daily (3 whole, 2 whites)',
    why: 'The gold standard of bioavailable amino acids. Zero prep hassle, kills sugar cravings for 4+ hours.',
    prepTime: '8 Minutes',
    ingredients: [
      '3 to 4 Fresh Eggs',
      'Freshly crushed black pepper & rock salt',
      'For Omelette: 4 Sambar Onions (Shallots), 1 green chili, curry leaves'
    ],
    steps: [
      'Option A (Boiled): Place eggs in boiling water for 9 minutes for perfect hard-boiled. Peel, slice in half, top with crushed black pepper and rock salt.',
      'Option B (Village Omelette): Beat 3 eggs with finely chopped sambar onions (shallots), green chili, curry leaves, and a pinch of turmeric.',
      'Pour onto a hot iron tawa with 1/2 tsp oil. Flip once golden brown.'
    ],
    proTip: 'Eating 2 boiled eggs at 4:00 PM completely kills the urge to snack on tea-shop biscuits.'
  },
  {
    name: 'Digestive Spiced Village Buttermilk (Neer Moru)',
    protein: '8g - 10g per big glass',
    target: '1 to 2 Glasses daily (After lunch & mid-day)',
    why: 'Cuts stomach bloating and inflammation that makes the lower belly push out. Fresh village probiotics.',
    prepTime: '3 Minutes',
    ingredients: [
      '1 Cup fresh village thick curd (Thayir)',
      '1 Cup cold water',
      '1 small piece ginger & 1 green chili (crushed)',
      'Curry leaves, coriander leaves, pinch of rock salt & hing (asafoetida)'
    ],
    steps: [
      '1. In a small mortar or mixer, coarsely crush the ginger, green chili, and curry leaves.',
      '2. Whisk 1 cup fresh curd with 1 cup water until smooth and frothy.',
      '3. Mix in the crushed ginger-chili paste, salt, and a tiny pinch of hing.',
      '4. Let it rest for 2 minutes for flavors to infuse, then drink.'
    ],
    proTip: 'Hing (asafoetida) + ginger completely eliminates gas and belly distension.'
  },
  {
    name: 'Sprouted Green Gram Sundal (Pasi Payaru)',
    protein: '15g per bowl',
    target: '1 Bowl as an evening snack',
    why: 'Complex carbs and high dietary fiber. Keeps blood sugar completely flat, forcing the body to burn belly fat.',
    prepTime: '5 Minutes (after soaking)',
    ingredients: [
      '1 Cup Green Gram (Pasi Payaru - soaked overnight or sprouted)',
      '1/2 tsp Mustard seeds & 1 Dry red chili',
      'Curry leaves, hing, rock salt',
      '1 tbsp Fresh grated coconut (optional)'
    ],
    steps: [
      '1. Soak green gram overnight (or 8 hours until small sprouts appear).',
      '2. Pressure cook for 1-2 whistles with water and salt (do not overcook into paste). Drain water.',
      '3. Heat 1/2 tsp oil in a pan, splutter mustard seeds, dry red chili, curry leaves, and hing.',
      '4. Add the boiled sprouts and toss well for 1 minute. Turn off stove and sprinkle fresh grated coconut.'
    ],
    proTip: 'Sprouting increases protein bioavailability and makes it 2x easier on your digestion.'
  },
  {
    name: 'Boiled Peanut Sundal (Uppu Kadalai)',
    protein: '25g per 100g (~12g per serving)',
    target: 'Handful (40g - 50g) with water or black tea',
    why: 'Replaces deep-fried mixture and bakery snacks with healthy fats and dense protein.',
    prepTime: '10 Minutes',
    ingredients: [
      'Raw Peanuts (Kadalai)',
      'Water and Rock salt',
      'Optional: Mustard seeds, green chili, curry leaves for tempering'
    ],
    steps: [
      '1. Wash raw peanuts thoroughly.',
      '2. Add to pressure cooker with water and 1 tsp rock salt.',
      '3. Pressure cook for 3 to 4 whistles until peanuts are soft and tender.',
      '4. Drain water and eat hot, or temper lightly with mustard and curry leaves.'
    ],
    proTip: 'Boiling peanuts preserves healthy fats while avoiding the inflammatory oxidized oils found in fried snacks.'
  }
];

const DEFAULT_EXERCISE_TUTORIALS = [
  {
    id: 'vacuum',
    title: 'The Stomach Vacuum (Flat Belly Secret)',
    target: 'Transverse Abdominis (Inner Abdominal Wall)',
    description: 'Do this while at your trading desk! Exhale all air, suck your navel into your spine, hold for 15-30 seconds. Pulls your lower belly inward like a natural belt.',
    videoId: 'dO7a6C17L4g'
  },
  {
    id: 'squat',
    title: 'Deep Bodyweight Squats (Kill Leg Shaking)',
    target: 'Quads, Glutes & Core Stability',
    description: 'Why your legs shake: Motor nerve units firing under new load. Start with sets of 5 or 10. In 10 days, the shaking stops and your resting calorie burn doubles.',
    videoId: 'aclHkVaku9U'
  },
  {
    id: 'pushup',
    title: 'Proper Pushup Form (Chest & Torso Broadening)',
    target: 'Upper Chest, Triceps, Shoulders',
    description: 'Tuck elbows to 45-degrees. Squeeze glutes and abs so you stay straight. Builds the upper body so your waist visually looks smaller and tight.',
    videoId: 'IODxDxX7oi4'
  },
  {
    id: 'plank',
    title: 'The Hollow-Body Plank',
    target: 'Full Core & Pelvic Anti-Extension',
    description: 'Tuck your pelvis under, squeeze your glutes tight. 30-45 seconds of this burns more abdominal fat than 100 crunches.',
    videoId: 'ASdvN_XEl_c'
  }
];

function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : urlOrId.trim();
}

export default function BodyProtocolPage() {
  const todayKey = new Date().toISOString().slice(0, 10);
  
  const [log, setLog] = useState<DailyLog>({
    date: todayKey,
    pushups: 0,
    squats: 0,
    vacuumsDone: 0,
    biscuitCount: 0,
    foodEntries: [],
    notes: ''
  });

  const [activeTab, setActiveTab] = useState<'tracker' | 'diet' | 'videos'>('tracker');
  const [tutorials, setTutorials] = useState(DEFAULT_EXERCISE_TUTORIALS);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [newVideoUrlInput, setNewVideoUrlInput] = useState('');

  // Expandable Recipe Drawer State
  const [expandedRecipeIdx, setExpandedRecipeIdx] = useState<number | null>(0); // First open by default

  // Quick Food Logging Inputs
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodQty, setCustomFoodQty] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [isJunkFlag, setIsJunkFlag] = useState(false);

  // 60s Hold Timer for Stomach Vacuums
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    idbGet<Partial<DailyLog>>(`${BODY_LOG_KEY}_${todayKey}`).then(saved => {
      if (saved) {
        setLog(prev => ({
          ...prev,
          ...saved,
          pushups: saved.pushups || 0,
          squats: saved.squats || 0,
          vacuumsDone: saved.vacuumsDone || 0,
          biscuitCount: saved.biscuitCount || 0,
          foodEntries: Array.isArray(saved.foodEntries) ? saved.foodEntries : []
        }));
      }
    });

    idbGet<Record<string, string>>(CUSTOM_VIDEOS_KEY).then(savedVideoMap => {
      if (savedVideoMap) {
        setTutorials(prev => prev.map(t => {
          if (savedVideoMap[t.id]) {
            return { ...t, videoId: savedVideoMap[t.id] };
          }
          return t;
        }));
      }
    });
  }, [todayKey]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(prev => prev - 1), 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const updateLog = (field: keyof DailyLog, value: any) => {
    setLog(prev => {
      const updated = { ...prev, [field]: value };
      idbSet(`${BODY_LOG_KEY}_${todayKey}`, updated);
      return updated;
    });
  };

  const addReps = (exercise: 'pushups' | 'squats' | 'vacuumsDone' | 'biscuitCount', amount: number) => {
    setLog(prev => {
      const current = prev[exercise] || 0;
      const updated = {
        ...prev,
        [exercise]: Math.max(0, current + amount)
      };
      idbSet(`${BODY_LOG_KEY}_${todayKey}`, updated);
      return updated;
    });
  };

  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFoodName.trim()) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEntry: FoodEntry = {
      id: `food-${Date.now()}`,
      time: now,
      name: customFoodName.trim(),
      qty: customFoodQty.trim() || '1 serving',
      estProtein: parseFloat(customProtein) || 0,
      isJunkLeak: isJunkFlag
    };

    setLog(prev => {
      const currentBiscuits = prev.biscuitCount || 0;
      const updated = {
        ...prev,
        biscuitCount: isJunkFlag ? currentBiscuits + 1 : currentBiscuits,
        foodEntries: [newEntry, ...(prev.foodEntries || [])]
      };
      idbSet(`${BODY_LOG_KEY}_${todayKey}`, updated);
      return updated;
    });

    setCustomFoodName('');
    setCustomFoodQty('');
    setCustomProtein('');
    setIsJunkFlag(false);
  };

  const handleDeleteFood = (id: string) => {
    setLog(prev => {
      const target = (prev.foodEntries || []).find(f => f.id === id);
      const currentBiscuits = prev.biscuitCount || 0;
      const updated = {
        ...prev,
        biscuitCount: target?.isJunkLeak ? Math.max(0, currentBiscuits - 1) : currentBiscuits,
        foodEntries: (prev.foodEntries || []).filter(f => f.id !== id)
      };
      idbSet(`${BODY_LOG_KEY}_${todayKey}`, updated);
      return updated;
    });
  };

  const handleQuickLogStaple = (name: string, qty: string, protein: number, isJunk = false) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEntry: FoodEntry = {
      id: `food-${Date.now()}`,
      time: now,
      name,
      qty,
      estProtein: protein,
      isJunkLeak: isJunk
    };

    setLog(prev => {
      const currentBiscuits = prev.biscuitCount || 0;
      const updated = {
        ...prev,
        biscuitCount: isJunk ? currentBiscuits + 1 : currentBiscuits,
        foodEntries: [newEntry, ...(prev.foodEntries || [])]
      };
      idbSet(`${BODY_LOG_KEY}_${todayKey}`, updated);
      return updated;
    });
  };

  const handleSaveCustomVideo = (id: string) => {
    const cleanId = extractYouTubeId(newVideoUrlInput);
    if (!cleanId) return;

    setTutorials(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, videoId: cleanId } : t);
      const mapToSave = updated.reduce((acc, t) => ({ ...acc, [t.id]: t.videoId }), {});
      idbSet(CUSTOM_VIDEOS_KEY, mapToSave);
      return updated;
    });

    setEditingVideoId(null);
    setNewVideoUrlInput('');
  };

  const currentBiscuitCount = log.biscuitCount || 0;
  const totalDailyProtein = (log.foodEntries || []).reduce((acc, f) => acc + (f.estProtein || 0), 0);

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100 font-sans selection:bg-emerald-500/20 antialiased p-3 sm:p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* TOP BAR */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#090A10] border border-white/[0.08] shadow-2xl">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors"
              title="Return to Trading Terminal"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm sm:text-base font-black text-white font-mono tracking-wider uppercase">
                  Body Recomp & Intake Protocol
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                  Belly Recomposition
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-500">
                Organic 5/10/20 scaling • High protein village recipes • Zero biscuits
              </p>
            </div>
          </div>

          <NivarpLogo size="sm" />
        </div>

        {/* NAVIGATION TABS */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08] font-mono text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => setActiveTab('tracker')}
            className={`py-2 px-3 rounded-xl transition-all border ${
              activeTab === 'tracker'
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-md font-black'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Exercise & Habits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diet')}
            className={`py-2 px-3 rounded-xl transition-all border ${
              activeTab === 'diet'
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-md font-black'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Intake & Recipes ({log.foodEntries?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`py-2 px-3 rounded-xl transition-all border ${
              activeTab === 'videos'
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-md font-black'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Form Videos (4)
          </button>
        </div>

        {/* TAB 1: EXERCISE TRACKER */}
        {activeTab === 'tracker' && (
          <div className="space-y-4 font-mono animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/20 to-black border border-emerald-500/30 text-xs space-y-1">
              <span className="text-emerald-300 font-bold flex items-center gap-1.5 uppercase text-[11px]">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Organic Scaling Protocol:</span>
              </span>
              <p className="text-emerald-200/80 leading-relaxed text-[11px]">
                Start with <strong>5 or 10 reps</strong> today. Don’t burn out or trigger extreme soreness on Day 1. Just like taking clean 1R profits, stack small sets of 5 throughout the day. Your strength will compound naturally.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#090A10] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Daily Pushups</span>
                  </span>
                  <span className="text-2xl font-black text-emerald-400">{log.pushups || 0} Reps</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[5, 10, 20].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => addReps('pushups', amt)}
                      className="flex-1 py-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-xs font-bold transition-all"
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateLog('pushups', 0)}
                    className="p-2 rounded-xl bg-white/[0.02] text-zinc-600 hover:text-rose-400 transition-colors"
                    title="Reset Pushups"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A10] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div>
                    <span className="text-xs text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Bodyweight Squats</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">Sets of 5 or 10 stop the shaking in 10 days</span>
                  </div>
                  <span className="text-2xl font-black text-cyan-300">{log.squats || 0} Reps</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[5, 10, 20].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => addReps('squats', amt)}
                      className="flex-1 py-2 rounded-xl bg-white/[0.03] hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 text-xs font-bold transition-all"
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateLog('squats', 0)}
                    className="p-2 rounded-xl bg-white/[0.02] text-zinc-600 hover:text-rose-400 transition-colors"
                    title="Reset Squats"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#090A10] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div>
                  <span className="text-xs font-bold text-white uppercase block">
                    Stomach Vacuum (Flat Belly Pull)
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Can do while seated at TradingView. Exhale completely, suck navel to spine, hold.
                  </span>
                </div>

                <div className="text-2xl font-black text-amber-400">
                  {timerSeconds}s
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(prev => !prev)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                    isTimerRunning
                      ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg'
                      : 'bg-amber-400 hover:bg-amber-300 text-black shadow-lg'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>{isTimerRunning ? 'Stop Vacuum' : 'Start 60s Hold'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(60);
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.03] text-zinc-400 hover:text-white border border-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => addReps('vacuumsDone', 1)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                >
                  +1 Set Done ({log.vacuumsDone || 0} sets)
                </button>
              </div>
            </div>

            {/* BISCUIT & SUGAR LEAK RADAR */}
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                <div className="flex items-center gap-2">
                  <Cookie className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-rose-300 uppercase block">
                      The Biscuit & Sugar Leak Radar
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Biscuits are maida + palm oil + sugar. The #1 cause of Indian lower belly fat.
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xl font-black ${currentBiscuitCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentBiscuitCount === 0 ? '0 Leaks' : `${currentBiscuitCount} Biscuits`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <span className="text-[11px] text-zinc-400">
                  {currentBiscuitCount === 0 
                    ? '🟢 Clean streak: Zero biscuits logged today! Belly fat burning active.' 
                    : '🔴 Sugar leak detected! Replace next snack with boiled eggs or sundal.'}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => addReps('biscuitCount', 1)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold"
                  >
                    +1 Biscuit Eaten
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLog('biscuitCount', 0)}
                    className="p-1.5 rounded-xl bg-white/[0.03] text-zinc-500 hover:text-white border border-white/10"
                    title="Reset to 0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTAKE & VILLAGE RECIPES */}
        {activeTab === 'diet' && (
          <div className="space-y-4 font-mono animate-in fade-in duration-150">
            <div className="p-4 rounded-2xl bg-[#090A10] border border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Today's Estimated Protein</span>
                <div className="text-2xl font-black text-emerald-400">
                  ~{totalDailyProtein}g <span className="text-xs text-zinc-500 font-normal">/ 75g Target</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Logged Items</span>
                <span className="text-sm font-bold text-white">{log.foodEntries?.length || 0} Meals/Snacks</span>
              </div>
            </div>

            {/* 1-Tap Quick Staples */}
            <div className="p-3.5 rounded-2xl bg-white/[0.015] border border-white/[0.06] space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                1-Tap Quick Log (Village Staples):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogStaple('Boiled Eggs', '2 eggs', 12)}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-zinc-300 text-left border border-white/10 transition-all"
                >
                  <span className="block font-bold text-white text-[11px]">+2 Eggs</span>
                  <span className="text-[9px] text-emerald-400">+12g protein</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogStaple('Soya Chunks', '50g cooked', 26)}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-zinc-300 text-left border border-white/10 transition-all"
                >
                  <span className="block font-bold text-white text-[11px]">+50g Soya</span>
                  <span className="text-[9px] text-emerald-400">+26g protein</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogStaple('Curd / Buttermilk', '1 big cup', 8)}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-zinc-300 text-left border border-white/10 transition-all"
                >
                  <span className="block font-bold text-white text-[11px]">+1 Cup Curd</span>
                  <span className="text-[9px] text-emerald-400">+8g protein</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogStaple('Sundal / Gram', '1 bowl', 14)}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-zinc-300 text-left border border-white/10 transition-all"
                >
                  <span className="block font-bold text-white text-[11px]">+1 Bowl Sundal</span>
                  <span className="text-[9px] text-emerald-400">+14g protein</span>
                </button>
              </div>
            </div>

            {/* Custom Food Entry Form */}
            <form onSubmit={handleAddFood} className="p-3.5 rounded-2xl bg-[#090A10] border border-white/[0.08] space-y-2.5">
              <span className="text-[11px] font-bold text-white uppercase block">
                Log Any Food / Snack / Meal Eaten:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  value={customFoodName}
                  onChange={(e) => setCustomFoodName(e.target.value)}
                  placeholder="What did you eat? (e.g. Rice with Sambar, 4 Biscuits)"
                  className="sm:col-span-1 bg-zinc-900 border border-white/10 rounded-xl p-2 text-white outline-none"
                  required
                />
                <input
                  type="text"
                  value={customFoodQty}
                  onChange={(e) => setCustomFoodQty(e.target.value)}
                  placeholder="How much? (e.g. 1 plate, 4 pcs, 1 cup)"
                  className="bg-zinc-900 border border-white/10 rounded-xl p-2 text-white outline-none"
                />
                <input
                  type="number"
                  value={customProtein}
                  onChange={(e) => setCustomProtein(e.target.value)}
                  placeholder="Protein in grams (optional)"
                  className="bg-zinc-900 border border-white/10 rounded-xl p-2 text-emerald-400 font-bold outline-none [appearance:textfield]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={isJunkFlag}
                    onChange={(e) => setIsJunkFlag(e.target.checked)}
                    className="rounded bg-zinc-900 border-white/20 text-rose-500 focus:ring-0"
                  />
                  <span>Mark as Sugar / Biscuit Leak ⚠️</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Meal</span>
                </button>
              </div>
            </form>

            {/* Today's Food Entries Timeline */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Today's Food Timeline:
              </span>

              {(!log.foodEntries || log.foodEntries.length === 0) ? (
                <div className="p-6 text-center text-zinc-600 rounded-2xl bg-white/[0.01] border border-dashed border-white/[0.05] text-xs">
                  No food logged today yet. Use 1-Tap quick logs or enter your meals above.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04] bg-[#090A10] border border-white/[0.08] rounded-2xl overflow-hidden">
                  {log.foodEntries.map(entry => (
                    <div key={entry.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-[10px] text-zinc-500">{entry.time}</span>
                        <div className="truncate">
                          <span className={`font-bold block truncate ${entry.isJunkLeak ? 'text-rose-400' : 'text-white'}`}>
                            {entry.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">Qty: {entry.qty}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {entry.isJunkLeak ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold">
                            Sugar Leak
                          </span>
                        ) : entry.estProtein > 0 ? (
                          <span className="text-emerald-400 font-bold text-[11px]">
                            +{entry.estProtein}g Pro
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleDeleteFood(entry.id)}
                          className="text-zinc-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* INTERACTIVE VILLAGE RECIPES ACCORDION */}
            <div className="space-y-2 pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold pb-1">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span className="uppercase text-[11px] tracking-wider">Village High-Protein Recipes (Click to Expand):</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {VILLAGE_FOODS.map((food, idx) => {
                  const isOpen = expandedRecipeIdx === idx;
                  return (
                    <div 
                      key={idx}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isOpen 
                          ? 'bg-[#0A0D14] border-emerald-500/40 shadow-lg' 
                          : 'bg-[#090A10] border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => setExpandedRecipeIdx(isOpen ? null : idx)}
                        className="w-full p-3.5 flex items-center justify-between text-left gap-3"
                      >
                        <div>
                          <span className="font-bold text-white text-xs block">{food.name}</span>
                          <span className="text-[10px] text-zinc-400 mt-0.5 block">{food.target} • {food.prepTime}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                            {food.protein}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                        </div>
                      </button>

                      {/* Expandable Recipe Body */}
                      {isOpen && (
                        <div className="p-3.5 pt-0 border-t border-white/[0.04] space-y-2.5 text-xs animate-in fade-in duration-100">
                          <p className="text-[11px] text-zinc-400 leading-relaxed pt-2">
                            {food.why}
                          </p>

                          {/* Ingredients */}
                          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1">
                            <span className="text-[10px] font-bold text-cyan-300 uppercase block">Simple Ingredients:</span>
                            <ul className="list-disc list-inside text-[10.5px] text-zinc-300 space-y-0.5">
                              {food.ingredients.map((ing, iIdx) => (
                                <li key={iIdx}>{ing}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Steps */}
                          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5">
                            <span className="text-[10px] font-bold text-emerald-300 uppercase block">How to make (Step by Step):</span>
                            <div className="space-y-1 text-[11px] text-zinc-200">
                              {food.steps.map((step, sIdx) => (
                                <p key={sIdx} className="leading-snug">{step}</p>
                              ))}
                            </div>
                          </div>

                          {/* Secret Pro Tip */}
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10.5px] text-amber-200/90">
                            <strong className="text-amber-300">💡 Pro Tip: </strong>{food.proTip}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: VIDEO FORM TUTORIALS */}
        {activeTab === 'videos' && (
          <div className="space-y-4 font-mono animate-in fade-in duration-150">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Watch each short form tutorial. You can also tap the pencil to customize with any YouTube video URL.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tutorials.map((ex) => (
                <div key={ex.id} className="p-3.5 rounded-2xl bg-[#090A10] border border-white/[0.08] space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06] gap-2">
                      <span className="text-xs font-bold text-white truncate">{ex.title}</span>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVideoId(editingVideoId === ex.id ? null : ex.id);
                            setNewVideoUrlInput(`https://www.youtube.com/watch?v=${ex.videoId}`);
                          }}
                          className="p-1 rounded-md bg-white/[0.03] text-zinc-400 hover:text-cyan-300 border border-white/10 transition-colors"
                          title="Change YouTube Video Link"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${ex.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-cyan-300 hover:text-white font-bold flex items-center gap-0.5 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/10"
                        >
                          <span>Open ↗</span>
                        </a>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 mt-1.5 leading-snug">{ex.description}</p>
                  </div>

                  {editingVideoId === ex.id && (
                    <div className="p-2 rounded-xl bg-black/60 border border-cyan-500/40 space-y-1.5 animate-in fade-in">
                      <span className="text-[10px] text-cyan-300 font-bold block">Paste Any YouTube Video Link:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newVideoUrlInput}
                          onChange={(e) => setNewVideoUrlInput(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomVideo(ex.id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg">
                    <iframe
                      src={`https://www.youtube.com/embed/${ex.videoId}`}
                      title={ex.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}