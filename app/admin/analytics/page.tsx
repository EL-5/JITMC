'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getLocalSubmissions, getLocalFields, PatientSubmission, FormField } from '@/lib/db';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  Users, 
  Calendar, 
  Activity, 
  BrainCircuit, 
  PieChartIcon, 
  BarChart4, 
  Sparkles,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

export default function AdminAnalytics() {
  const { theme } = useTheme();
  const [fields, setFields] = useState<FormField[]>([]);
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalyticsData = async () => {
      setLoading(true);
      try {
        const localFields = await getLocalFields();
        setFields(localFields);

        const localSubs = await getLocalSubmissions();
        setSubmissions(localSubs);
      } catch (e) {
        console.error('Failed to load analytics data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadAnalyticsData();
  }, []);

  // Theme colors depending on current theme state
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = isDark ? '#38bdf8' : '#0284c7';

  const colorsList = ['#0284c7', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

  // ================= 1. DYNAMIC REGISTRATION TRENDS (Daily) =================
  const dailyTrendsData = useMemo(() => {
    if (submissions.length === 0) return [];
    
    // Aggregate registrations by date
    const dateCounts: Record<string, number> = {};
    
    submissions.forEach((sub) => {
      const dateStr = new Date(sub.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    // Convert to sorted array (reverse chronologically first then chronological display)
    return Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .reverse() // Newest first from submissions, reverse to oldest first for line progression
      .slice(-10); // Display last 10 active days
  }, [submissions]);

  // ================= 2. GENDER RATIO ANALYSIS =================
  const genderDistributionData = useMemo(() => {
    const genderField = fields.find(
      (f) => f.label.toLowerCase() === 'gender' || f.label.toLowerCase() === 'sex'
    );

    if (!genderField || submissions.length === 0) {
      return [
        { name: 'Male', value: 0 },
        { name: 'Female', value: 0 },
        { name: 'Other', value: 0 }
      ];
    }

    const counts: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
    submissions.forEach((sub) => {
      const val = sub.values[genderField.id] || 'Other';
      if (val.includes('Male')) counts.Male++;
      else if (val.includes('Female')) counts.Female++;
      else counts.Other++;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [submissions, fields]);

  // ================= 3. AGE DISTRIBUTION DEMOGRAPHICS =================
  const ageDistributionData = useMemo(() => {
    const ageField = fields.find(
      (f) => f.label.toLowerCase() === 'age' || f.type === 'number' && f.label.toLowerCase().includes('age')
    );

    if (!ageField || submissions.length === 0) return [];

    const buckets = {
      'Child (0-12)': 0,
      'Teen (13-19)': 0,
      'Adult (20-59)': 0,
      'Senior (60+)': 0
    };

    submissions.forEach((sub) => {
      const ageVal = parseInt(sub.values[ageField.id]);
      if (isNaN(ageVal)) return;
      if (ageVal <= 12) buckets['Child (0-12)']++;
      else if (ageVal <= 19) buckets['Teen (13-19)']++;
      else if (ageVal <= 59) buckets['Adult (20-59)']++;
      else buckets['Senior (60+)']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [submissions, fields]);

  // ================= 4. SMART ADAPTIVE ANALYTICS ENGINE =================
  // Scans all dynamic select/checkbox/radio fields (e.g. Diagnosis, Medication, Symptoms)
  // and aggregates the answer frequencies to automatically plot custom distribution insights cards!
  const customDynamicAnalytics = useMemo(() => {
    if (submissions.length === 0 || fields.length === 0) return [];

    const charts: Array<{ fieldLabel: string; type: string; data: Array<{ name: string; value: number }> }> = [];

    // Filter dynamic filterable fields, excluding base Full Name / Age / Gender
    const filterableFields = fields.filter((f) => 
      ['select', 'radio', 'checkbox'].includes(f.type) && 
      !['gender', 'sex', 'full name', 'name', 'age'].includes(f.label.toLowerCase())
    );

    filterableFields.forEach((field) => {
      const optionCounts: Record<string, number> = {};

      submissions.forEach((sub) => {
        const valStr = sub.values[field.id] || '';
        if (!valStr) return;

        // Split multi-checkbox values
        const answers = valStr.split(', ');
        answers.forEach((ans) => {
          if (ans.trim()) {
            optionCounts[ans] = (optionCounts[ans] || 0) + 1;
          }
        });
      });

      const data = Object.entries(optionCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) // Sort by descending frequency
        .slice(0, 8); // Top 8 choices to prevent chart bloat

      if (data.length > 0) {
        charts.push({
          fieldLabel: field.label,
          type: field.type,
          data
        });
      }
    });

    return charts;
  }, [submissions, fields]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4 border-b dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Smart Analytics Console
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 dark:bg-slate-950/20 px-2 py-0.5 rounded uppercase tracking-wider">
              <BrainCircuit className="h-3 w-3 animate-pulse" /> Adaptive AI
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time visual telemetry mapping patient volumes, demographics, registrations, and adaptive custom field distributions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-2 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs">Compiling real-time patient statistics...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs text-slate-400">
          <AlertCircle className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
          <p className="font-bold text-base">Insufficient Analytics Telemetry</p>
          <p className="text-xs mt-0.5 max-w-sm mx-auto">Register patient records inside the volunteer form first to generate analytical insight plots.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* TOP METRIC CARDS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* Card 1: Total Patients */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs p-6 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Patients</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">
                  {submissions.length}
                </span>
                <span className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> Live Registrations
                </span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-950/20 text-slate-500 rounded-2xl shadow-inner">
                <Users className="h-6 w-6" />
              </div>
            </div>

            {/* Card 2: Offline Pending */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs p-6 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Local Offline Records</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">
                  {submissions.filter((s) => s.synced === 0).length}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-2">
                  Waiting online sync
                </span>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl">
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            {/* Card 3: Form Adaptations */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs p-6 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Intake Fields Count</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">
                  {fields.length}
                </span>
                <span className="text-[10px] text-slate-500 font-bold mt-2 flex items-center gap-0.5">
                  <Sparkles className="h-3 w-3" /> Fully Dynamic
                </span>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 text-purple-500 rounded-2xl">
                <Activity className="h-6 w-6" />
              </div>
            </div>

          </div>

          {/* MAIN GRAPHICS CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Daily Registrations Line Chart (Col 8) */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Patient Registry Timeline
              </h3>
              
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendsData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" stroke={textColor} fontSize={10} tickLine={false} />
                    <YAxis stroke={textColor} fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#151d30' : '#ffffff', 
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }} 
                    />
                    <Area type="monotone" dataKey="count" stroke={primaryColor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" name="Patients Registered" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gender Distribution Pie Chart (Col 4) */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <PieChartIcon className="h-4 w-4 text-slate-500" /> Gender Ratios
              </h3>

              <div className="h-56 flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {genderDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colorsList[index % colorsList.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: isDark ? '#151d30' : '#ffffff', 
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Age Demographics Bar Chart (Col 6) */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-1.5">
                <BarChart4 className="h-4 w-4 text-slate-500" /> Patient Age Demographics
              </h3>

              <div className="h-70 w-full">
                {ageDistributionData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    Age field not pre-configured or missing patient registration answers.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistributionData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="range" stroke={textColor} fontSize={10} tickLine={false} />
                      <YAxis stroke={textColor} fontSize={10} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: isDark ? '#151d30' : '#ffffff', 
                          borderColor: isDark ? '#1e293b' : '#e2e8f0',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Patients Count" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* DYNAMIC AND DEDICATED FIELD ANALYZER TELEMETRY BLOCK (Col 6) */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <BrainCircuit className="h-4 w-4 text-slate-500" /> Dynamic Field Telemetry Insights
              </h3>

              <div className="flex-1 flex flex-col gap-6 max-h-[300px] overflow-y-auto pr-1">
                {customDynamicAnalytics.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic text-center py-12">
                    No custom choices-based inputs (select/radio/checkbox) detected to map analytical insights.
                  </div>
                ) : (
                  customDynamicAnalytics.map((chart) => (
                    <div key={chart.fieldLabel} className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
                        <span className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                          {chart.fieldLabel} Distribution
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/30 py-0.5 px-2 rounded">
                          {chart.type} Analysis
                        </span>
                      </div>

                      {/* Distribution Bars */}
                      <div className="flex flex-col gap-2.5">
                        {chart.data.map((item, idx) => {
                          const total = chart.data.reduce((acc, curr) => acc + curr.value, 0);
                          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                          return (
                            <div key={item.name} className="flex flex-col gap-1 text-[11px]">
                              <div className="flex justify-between text-slate-600 dark:text-slate-400 font-semibold">
                                <span>{item.name}</span>
                                <span className="font-bold">{item.value} patients ({percentage}%)</span>
                              </div>
                              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: colorsList[idx % colorsList.length] 
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
