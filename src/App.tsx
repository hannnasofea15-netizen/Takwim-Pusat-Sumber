import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Tag, 
  Target, 
  X, 
  Edit2, 
  Trash2, 
  BarChart3,
  CalendarDays,
  Download,
  LayoutGrid,
  Calendar as CalendarMonthIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Types
interface Program {
  id?: number;
  date: string; // YYYY-MM-DD
  name: string;
  time: string;
  location: string;
  category: string;
  purpose: string;
  year: number;
}

const CATEGORIES = [
  'Galakan Membaca',
  'Literasi Maklumat',
  'Digital',
  'TVPSS',
  'Pengawas Pusat Sumber',
  'AJK PSS',
  'Pengurusan'
];

const YEARS = Array.from({ length: 2055 - 2026 + 1 }, (_, i) => 2026 + i);

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); // Start from 2026
  const [programs, setPrograms] = useState<Program[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    time: '',
    location: '',
    category: CATEGORIES[0],
    purpose: ''
  });

  const [appWidth, setAppWidth] = useState<'standard' | 'wide' | 'full'>('standard');

  const calendarRef = useRef<HTMLDivElement>(null);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const widthClasses = {
    standard: 'w-full max-w-7xl',
    wide: 'w-full lg:max-w-[95%]',
    full: 'w-full px-2 md:px-6'
  };

  // Fetch programs
  useEffect(() => {
    fetch(`/api/programs?year=${currentYear}`)
      .then(res => res.json())
      .then(data => setPrograms(data))
      .catch(err => console.error('Error fetching programs:', err));
  }, [currentYear]);

  // Fetch category colors
  useEffect(() => {
    fetch('/api/category-colors')
      .then(res => res.json())
      .then(data => {
        // Initialize with defaults if missing
        const colors = { ...data };
        const defaultColors = [
          '#065f46', // emerald-800
          '#1e40af', // blue-800
          '#991b1b', // red-800
          '#854d0e', // amber-800
          '#5b21b6', // violet-800
          '#374151', // gray-700
          '#164e63'  // cyan-900
        ];
        CATEGORIES.forEach((cat, i) => {
          if (!colors[cat]) {
            colors[cat] = defaultColors[i % defaultColors.length];
          }
        });
        setCategoryColors(colors);
      })
      .catch(err => console.error('Error fetching category colors:', err));
  }, []);

  const updateCategoryColor = async (category: string, color: string) => {
    setCategoryColors(prev => ({ ...prev, [category]: color }));
    try {
      await fetch('/api/category-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, color })
      });
    } catch (err) {
      console.error('Error saving category color:', err);
    }
  };

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const setYear = (year: number) => setCurrentDate(new Date(year, currentMonth, 1));

  const formatDate = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const programsByDate = useMemo(() => {
    const map: Record<string, Program[]> = {};
    programs.forEach(p => {
      if (!map[p.date]) map[p.date] = [];
      map[p.date].push(p);
    });
    return map;
  }, [programs]);

  const yearlyStats = useMemo(() => {
    const stats: Record<string, number> = {};
    CATEGORIES.forEach(cat => stats[cat] = 0);
    programs.forEach(p => {
      if (stats[p.category] !== undefined) stats[p.category]++;
    });
    return stats;
  }, [programs]);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditingProgram(null);
    setFormData({
      name: '',
      time: '',
      location: '',
      category: CATEGORIES[0],
      purpose: ''
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, program: Program) => {
    e.stopPropagation();
    setEditingProgram(program);
    setFormData(program);
    setSelectedDate(program.date);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent, id: number | undefined, name?: string) => {
    console.log('handleDeleteClick triggered', { id, name });
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (id === undefined || id === null) {
      console.error('Delete failed: ID is undefined or null');
      alert('ID program tidak dijumpai. Sila muat semula halaman.');
      return false;
    }
    
    const message = name 
      ? `Adakah anda pasti ingin memadam program "${name}"? Tindakan ini tidak boleh dibatalkan.`
      : 'Adakah anda pasti ingin memadam program ini? Tindakan ini tidak boleh dibatalkan.';

    if (window.confirm(message)) {
      try {
        console.log(`Requesting delete for ID: ${id}`);
        const res = await fetch(`/api/programs/${id}`, { 
          method: 'DELETE',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log('Delete response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('Delete success data:', data);
          
          // Update state immediately
          setPrograms(currentPrograms => {
            const updated = currentPrograms.filter(p => {
              const pId = Number(p.id);
              const targetId = Number(id);
              return pId !== targetId;
            });
            console.log(`State updated. Old count: ${currentPrograms.length}, New count: ${updated.length}`);
            return updated;
          });
          
          return true;
        } else {
          const errorText = await res.text();
          console.error('Delete failed on server:', errorText);
          alert(`Gagal memadam program (Ralat ${res.status}). Sila cuba lagi.`);
          return false;
        }
      } catch (err) {
        console.error('Error during delete request:', err);
        alert('Ralat rangkaian semasa memadam program. Sila periksa sambungan anda.');
        return false;
      }
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    const payload = {
      ...formData,
      date: selectedDate,
      year: new Date(selectedDate).getFullYear()
    };

    if (editingProgram?.id) {
      const res = await fetch(`/api/programs/${editingProgram.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setPrograms(prev => prev.map(p => p.id === editingProgram.id ? { ...p, ...payload } : p));
        setIsModalOpen(false);
      } else {
        alert('Gagal mengemaskini program. Sila cuba lagi.');
      }
    } else {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        setPrograms(prev => [...prev, { ...payload, id: data.id } as Program]);
        setIsModalOpen(false);
      } else {
        alert('Gagal menyimpan program baru. Sila cuba lagi.');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm(`Adakah anda pasti ingin mengosongkan SEMUA data program untuk tahun ${currentYear}? Tindakan ini tidak boleh dibatalkan.`)) {
      try {
        const res = await fetch(`/api/programs?year=${currentYear}`, { method: 'DELETE' });
        if (res.ok) {
          setPrograms(prev => prev.filter(p => p.year !== currentYear));
          alert(`Semua data program tahun ${currentYear} telah dikosongkan.`);
        } else {
          alert('Gagal mengosongkan data. Sila cuba lagi.');
        }
      } catch (err) {
        console.error('Error clearing programs:', err);
        alert('Ralat semasa mengosongkan data.');
      }
    }
  };

  const exportPDF = async () => {
    if (!calendarRef.current) return;
    
    const canvas = await html2canvas(calendarRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0a0a0a'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Takwim_PSS_AlFaaeq_${currentYear}_${viewMode}.pdf`);
  };

  const renderMiniMonth = (monthIndex: number) => {
    const days = daysInMonth(currentYear, monthIndex);
    const firstDay = firstDayOfMonth(currentYear, monthIndex);
    const monthName = new Intl.DateTimeFormat('ms-MY', { month: 'long' }).format(new Date(currentYear, monthIndex));

    return (
      <div key={monthIndex} className="bg-white/95 rounded-2xl border border-stone-200 overflow-hidden shadow-md backdrop-blur-sm p-3">
        <h4 className="text-center font-serif font-bold text-emerald-900 mb-2 border-b border-stone-100 pb-1">{monthName}</h4>
        <div className="grid grid-cols-7 gap-1 text-[8px] font-black text-stone-400 text-center mb-1">
          {['A', 'I', 'S', 'R', 'K', 'J', 'S'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(currentYear, monthIndex, day);
            const dayPrograms = programsByDate[dateStr] || [];
            const hasProgram = dayPrograms.length > 0;
            const catColor = hasProgram ? (categoryColors[dayPrograms[0].category] || '#fbbf24') : 'transparent';
            
            return (
              <div 
                key={day} 
                onClick={() => handleDayClick(dateStr)}
                className={`text-[9px] text-center p-0.5 rounded-md transition-colors cursor-pointer hover:bg-emerald-50 ${
                  hasProgram ? 'font-bold' : 'text-stone-400'
                }`}
                style={hasProgram ? { backgroundColor: catColor, color: '#fff' } : {}}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="bg-overlay" />
      
      {/* Header & Year Navigation */}
      <header className="bg-stone-950/95 border-b border-amber-400/30 pt-8 pb-6 px-6 z-20 shadow-2xl backdrop-blur-md">
        <div className={`${widthClasses[appWidth]} mx-auto`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 border border-amber-400/30 rounded-2xl shadow-lg backdrop-blur-sm group hover:border-amber-400 transition-colors">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1ToceRMdkCRh0N0chykIazhK8cEJ9PSuB" 
                    alt="Logo Sekolah" 
                    className="w-14 h-14 object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-2 bg-white/5 border border-amber-400/30 rounded-2xl shadow-lg backdrop-blur-sm group hover:border-amber-400 transition-colors">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1iAhO_Bc1BOoM_7N_irCx8TSSTG_Wz7qz" 
                    alt="Logo PSS" 
                    className="w-14 h-14 object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="h-12 w-px bg-amber-400/20 mx-2 hidden md:block" />
              <div>
                <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-amber-400">
                  Takwim Pusat Sumber Al-Faaeq
                </h1>
                <p className="text-emerald-400 font-bold tracking-widest text-xs uppercase mt-1">
                  SK Lubok Temiang • WP Labuan
                </p>
              </div>
            </div>
            
              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/60">Tahun Takwim</span>
                  <select 
                    value={currentYear}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="bg-stone-900 text-amber-400 border border-amber-400/20 rounded-xl px-3 py-1 text-sm font-black outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                
                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2">
                  <button 
                    onClick={() => handleDayClick(new Date().toISOString().split('T')[0])}
                    className="bg-amber-400 hover:bg-amber-300 text-stone-950 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-400/20"
                  >
                    <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Tambah Program</span>
                  </button>
                  
                  <div className="hidden sm:flex items-center bg-stone-900 rounded-2xl p-1 border border-amber-400/20 shadow-inner">
                  <button
                    onClick={() => setAppWidth('standard')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                      appWidth === 'standard' ? 'bg-amber-400 text-stone-950' : 'text-stone-500'
                    }`}
                    title="Keluasan Standard"
                  >
                    S
                  </button>
                  <button
                    onClick={() => setAppWidth('wide')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                      appWidth === 'wide' ? 'bg-amber-400 text-stone-950' : 'text-stone-500'
                    }`}
                    title="Keluasan Lebar"
                  >
                    W
                  </button>
                  <button
                    onClick={() => setAppWidth('full')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                      appWidth === 'full' ? 'bg-amber-400 text-stone-950' : 'text-stone-500'
                    }`}
                    title="Keluasan Penuh"
                  >
                    F
                  </button>
                </div>

                <div className="flex items-center bg-stone-900 rounded-2xl p-1 border border-amber-400/20 shadow-inner">
                  <button
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      viewMode === 'monthly' 
                      ? 'bg-amber-400 text-stone-950 shadow-md' 
                      : 'text-stone-500 hover:text-amber-400/80'
                    }`}
                  >
                    <CalendarMonthIcon className="w-3 h-3" /> Bulanan
                  </button>
                  <button
                    onClick={() => setViewMode('yearly')}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      viewMode === 'yearly' 
                      ? 'bg-amber-400 text-stone-950 shadow-md' 
                      : 'text-stone-500 hover:text-amber-400/80'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" /> Tahunan
                  </button>
                </div>
                
                <button 
                  onClick={exportPDF}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* Cumulative Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="emerald-gradient rounded-2xl p-5 text-white shadow-xl border border-emerald-400/20 flex items-center justify-between group hover:scale-[1.02] transition-transform">
              <div>
                <p className="text-emerald-300 text-[10px] font-black uppercase tracking-widest">Jumlah Program {currentYear}</p>
                <h3 className="text-4xl font-serif font-bold mt-1">{programs.length} <span className="text-sm font-sans font-normal opacity-60 italic">Aktiviti</span></h3>
              </div>
              <div className="bg-white/10 p-3 rounded-xl group-hover:bg-white/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            
            <div className="bg-stone-900/80 border border-amber-400/20 rounded-2xl p-5 flex items-center justify-between backdrop-blur-sm">
              <div>
                <p className="text-amber-400/60 text-[10px] font-black uppercase tracking-widest">Bulan Ini</p>
                <h3 className="text-4xl font-serif font-bold mt-1 text-amber-400">
                  {programs.filter(p => new Date(p.date).getMonth() === currentMonth).length}
                </h3>
              </div>
              <div className="bg-amber-400/10 p-3 rounded-xl text-amber-400">
                <CalendarIcon className="w-6 h-6" />
              </div>
            </div>

            <div className="md:col-span-2 brown-gradient border border-amber-400/20 rounded-2xl p-5 flex items-center gap-5">
              <div className="bg-amber-400 text-stone-950 p-3 rounded-xl shadow-lg">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Fokus Strategik</p>
                <p className="text-stone-100 font-serif italic text-lg mt-0.5">"Meningkatkan Literasi Maklumat & Budaya Membaca Digital"</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-grow ${widthClasses[appWidth]} mx-auto w-full p-6 relative z-10`}>
        <div ref={calendarRef} className="space-y-8">
          {viewMode === 'monthly' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Calendar Section */}
              <section className="lg:col-span-8 space-y-6">
                <div className="bg-white/95 rounded-3xl border border-stone-200 overflow-hidden shadow-2xl backdrop-blur-md">
                  <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-emerald-900 text-white">
                    <div className="flex items-center gap-4">
                      <h2 className="text-3xl font-serif font-bold tracking-tight">
                        {new Intl.DateTimeFormat('ms-MY', { month: 'long' }).format(currentDate)}
                      </h2>
                      <div className="h-6 w-px bg-white/20" />
                      <p className="text-amber-400 font-black tracking-widest text-sm">{currentYear}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={prevMonth} className="p-2.5 hover:bg-white/10 rounded-xl transition-all border border-white/20 text-white">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={nextMonth} className="p-2.5 hover:bg-white/10 rounded-xl transition-all border border-white/20 text-white">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="calendar-grid bg-stone-50/50">
                    {['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'].map(day => (
                      <div key={day} className="py-5 text-center text-[10px] font-black uppercase tracking-[0.25em] text-emerald-900/60 border-b border-stone-100">
                        {day}
                      </div>
                    ))}
                    
                    {Array.from({ length: firstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-40 bg-stone-100/30 border-r border-b border-stone-100/50" />
                    ))}

                    {Array.from({ length: daysInMonth(currentYear, currentMonth) }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = formatDate(currentYear, currentMonth, day);
                      const dayPrograms = programsByDate[dateStr] || [];
                      const isToday = new Date().toISOString().split('T')[0] === dateStr;

                      return (
                        <div 
                          key={day} 
                          onClick={() => handleDayClick(dateStr)}
                          className={`min-h-[70px] sm:min-h-[100px] md:h-40 p-1.5 sm:p-3 border-r border-b border-stone-100 bg-white hover:bg-emerald-50/30 transition-all cursor-pointer group relative`}
                        >
                          <div className="flex justify-between items-start mb-1 sm:mb-2">
                            <span className={`text-xs sm:text-sm font-black ${isToday ? 'bg-emerald-800 text-white w-6 h-6 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl shadow-lg shadow-emerald-900/30' : 'text-stone-300 group-hover:text-emerald-800'}`}>
                              {day}
                            </span>
                            {dayPrograms.length > 0 && (
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                            )}
                          </div>
                          
                          <div className="space-y-1 overflow-y-auto max-h-[40px] sm:max-h-[85px] scrollbar-hide">
                            {dayPrograms.map(p => (
                              <div 
                                key={p.id}
                                onClick={(e) => handleEditClick(e, p)}
                                className="text-[7px] sm:text-[9px] font-black leading-tight px-1 sm:px-2.5 py-1 sm:py-2 rounded-md sm:rounded-lg bg-stone-50 border-y border-r border-stone-200 text-stone-700 truncate hover:bg-white hover:shadow-md transition-all flex items-center justify-between group/item"
                                style={{ borderLeftWidth: '4px', borderLeftColor: categoryColors[p.category] || '#065f46' }}
                              >
                                <span className="truncate">{p.name}</span>
                                <button 
                                  onClick={(e) => handleDeleteClick(e, p.id, p.name)}
                                  className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-red-50 text-red-500 rounded-md transition-all relative z-20"
                                  title="Padam Program"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-2.5 sm:h-2.5 pointer-events-none" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="absolute bottom-1 right-1 sm:bottom-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-800 text-white p-1 rounded-md sm:rounded-lg shadow-lg">
                            <Plus className="w-2 h-2 sm:w-3 sm:h-3" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Sidebar Stats */}
              <aside className="lg:col-span-4 space-y-6">
                <div className="bg-stone-950 rounded-3xl border border-amber-400/20 p-7 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="flex items-center justify-between mb-10 relative z-10">
                    <h3 className="text-xl font-serif font-bold text-amber-400">Pecahan Kategori</h3>
                    <Tag className="w-6 h-6 text-amber-400/40" />
                  </div>
                  
                  <div className="space-y-6 relative z-10">
                    {CATEGORIES.map(cat => (
                      <div key={cat} className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={categoryColors[cat] || '#065f46'} 
                              onChange={(e) => updateCategoryColor(cat, e.target.value)}
                              className="w-4 h-4 rounded-full overflow-hidden cursor-pointer border-none bg-transparent"
                              title="Tukar Warna Kategori"
                            />
                            <span className="text-stone-400">{cat}</span>
                          </div>
                          <span className="text-amber-400">{yearlyStats[cat]}</span>
                        </div>
                        <div className="h-2.5 bg-stone-900 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(yearlyStats[cat] / (programs.length || 1)) * 100}%` }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: categoryColors[cat] || '#065f46' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/90 rounded-3xl border border-stone-200 p-7 shadow-xl backdrop-blur-md">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-900/40 mb-6">Aktiviti Akan Datang</h4>
                  <div className="space-y-5">
                    {programs
                      .filter(p => new Date(p.date) >= new Date())
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .slice(0, 3)
                      .map(p => (
                        <div key={p.id} className="flex gap-5 items-start group cursor-pointer" onClick={(e) => handleEditClick(e, p)}>
                          <div 
                            className="border border-amber-400/20 rounded-2xl p-3 text-center min-w-[60px] shadow-lg group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: categoryColors[p.category] || '#064e3b' }}
                          >
                            <span className="block text-[10px] font-black uppercase text-white/60">{new Date(p.date).toLocaleDateString('ms-MY', { month: 'short' })}</span>
                            <span className="block text-2xl font-serif font-bold text-white">{new Date(p.date).getDate()}</span>
                          </div>
                          <div className="pt-1">
                            <h5 className="text-sm font-black text-stone-900 leading-tight group-hover:text-emerald-700 transition-colors">{p.name}</h5>
                            <p className="text-[11px] font-bold text-stone-400 mt-1.5 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-500" /> {p.location}
                            </p>
                          </div>
                        </div>
                      ))}
                    {programs.filter(p => new Date(p.date) >= new Date()).length === 0 && (
                      <p className="text-xs text-stone-400 italic text-center py-4">Tiada aktiviti akan datang dijadualkan.</p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-emerald-900 rounded-3xl p-8 text-white shadow-2xl border border-amber-400/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-serif font-bold tracking-tight text-amber-400">Takwim Tahunan {currentYear}</h2>
                    <p className="text-emerald-200 mt-2 font-medium">Paparan penuh aktiviti Pusat Sumber Al-Faaeq bagi sepanjang tahun.</p>
                  </div>
                  <div className="bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-md border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Jumlah Aktiviti</p>
                    <p className="text-3xl font-serif font-bold">{programs.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 12 }).map((_, i) => renderMiniMonth(i))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-amber-400/20 mt-12 bg-stone-950 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900/10" />
        <div className={`${widthClasses[appWidth]} mx-auto relative z-10`}>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px w-16 bg-amber-400/30" />
              <div className="w-3 h-3 rotate-45 border border-amber-400" />
              <div className="h-px w-16 bg-amber-400/30" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-amber-400 text-sm font-black tracking-[0.3em] uppercase">
                Dihasilkan oleh Guru Perpustakaan dan Media
              </p>
              <p className="text-stone-500 text-xs font-bold tracking-widest uppercase">
                Pusat Sumber Al-Faaeq • SK Lubok Temiang • 2026
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-stone-950 border border-amber-400/30 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] relative z-10 flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-amber-400/20 flex items-center justify-between bg-stone-900 shrink-0">
                <div>
                  <h3 className="text-xl font-serif font-bold text-amber-400">
                    {editingProgram ? 'Kemaskini Program' : 'Tambah Program Baru'}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mt-1">
                    {new Date(selectedDate!).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-amber-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-hide">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Nama Program</label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all text-white placeholder:text-stone-700"
                    placeholder="Contoh: Jom Baca 10 Minit"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                      <CalendarIcon className="w-3 h-3 text-amber-400" /> Tarikh
                    </label>
                    <input 
                      required
                      type="date"
                      value={selectedDate || ''}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-amber-400" /> Masa
                    </label>
                    <input 
                      type="text"
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all text-white placeholder:text-stone-700"
                      placeholder="08:00 AM"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-amber-400" /> Tempat
                  </label>
                  <input 
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all text-white placeholder:text-stone-700"
                    placeholder="Dewan Sekolah"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                    <Tag className="w-3 h-3 text-amber-400" /> Kategori Program
                  </label>
                  <div className="relative flex items-center">
                    <div 
                      className="absolute left-3 w-3 h-3 rounded-full z-10"
                      style={{ backgroundColor: categoryColors[formData.category || ''] || '#065f46' }}
                    />
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all appearance-none text-white"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-stone-900">{cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                    <Target className="w-3 h-3 text-amber-400" /> Tujuan Program
                  </label>
                  <textarea 
                    rows={3}
                    value={formData.purpose}
                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-900 border border-amber-400/10 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all resize-none text-white placeholder:text-stone-700"
                    placeholder="Nyatakan objektif program..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  {editingProgram && (
                    <button 
                      type="button"
                      onClick={async (e) => {
                        const success = await handleDeleteClick(e as any, editingProgram.id!, editingProgram.name);
                        if (success) {
                          setIsModalOpen(false);
                        }
                      }}
                      className="px-4 py-3 border border-red-500/30 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-colors uppercase tracking-widest text-[10px] flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" /> Padam
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-amber-400/20 rounded-xl font-bold text-stone-400 hover:bg-white/5 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-amber-400 text-stone-950 rounded-xl font-black hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20 uppercase tracking-widest text-[10px]"
                  >
                    {editingProgram ? 'Simpan Perubahan' : 'Tambah Program'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
