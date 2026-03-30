import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Plus, Trash2, CheckCircle2, Circle, Calendar,
    Tag, AlertCircle, Filter, ArrowUpDown, ListTodo,
    LayoutGrid, ChevronDown, ChevronUp, AlignLeft,
    CheckSquare, Square, X, Download, Cloud, CloudOff
} from 'lucide-react';

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwqIV4GTHXea8MpG4H3N6ya_U_gLG4baXyD-psFnBLnsLHfK6H39fmdn0iLO6Dw5zE/exec';

const App = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [input, setInput] = useState('');
    const [subtaskInput, setSubtaskInput] = useState({});
    const [category, setCategory] = useState('ทั่วไป');
    const [priority, setPriority] = useState('กลาง');
    const [filter, setFilter] = useState('ทั้งหมด');
    const [sortBy, setSortBy] = useState('id');

    const categories = ['ทั้งหมด', 'ทั่วไป', 'งาน', 'ส่วนตัว', 'สุขภาพ', 'การเงิน'];
    const priorities = ['ต่ำ', 'กลาง', 'สูง'];

    // (1) Data fetching from Google Sheets
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(WEB_APP_URL);
                const data = await response.json();
                
                const formattedData = data.map(item => ({
                    ...item,
                    completed: item.completed === true || item.completed === 'true' || item.completed === 'TRUE',
                    subtasks: item.subtasks ? JSON.parse(item.subtasks) : [],
                    isExpanded: false,
                    createdAt: item.id // use id as createdAt timestamp fallback
                }));
                
                setTasks(formattedData);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching data from Google Sheets:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const saveToSheets = useCallback(async (newTasks) => {
        setTasks(newTasks);
        setSaving(true);
        try {
            await fetch(WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(newTasks)
            });
        } catch (error) {
            console.error("Error saving to Sheets:", error);
        } finally {
            setSaving(false);
        }
    }, []);

    // Task Operations
    const addTask = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const taskId = Date.now().toString();
        const newTask = {
            id: taskId,
            text: input,
            description: '',
            subtasks: [],
            category: category === 'ทั้งหมด' ? 'ทั่วไป' : category,
            priority: priority,
            completed: false,
            date: new Date().toLocaleDateString('th-TH'),
            createdAt: Date.now(),
            isExpanded: false
        };

        const newTasks = [...tasks, newTask];
        setInput('');
        saveToSheets(newTasks);
    };

    const toggleComplete = (taskId, currentStatus, e) => {
        e.stopPropagation();
        const newTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t);
        saveToSheets(newTasks);
    };

    const deleteTask = (taskId, e) => {
        e.stopPropagation();
        if (window.confirm('คุณต้องการลบงานนี้ใช่หรือไม่?')) {
            const newTasks = tasks.filter(t => t.id !== taskId);
            saveToSheets(newTasks);
        }
    };

    const toggleExpand = (taskId, currentExpanded) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, isExpanded: !currentExpanded } : t));
    };

    // debounce description updates to avoid spamming Google Sheets
    const handleDescriptionBlur = (taskId, objValue) => {
        const newTasks = tasks.map(t => t.id === taskId ? { ...t, description: objValue } : t);
        saveToSheets(newTasks);
    };

    const updateDescriptionLocally = (taskId, value) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, description: value } : t));
    };

    // Subtask Operations
    const addSubtask = (taskId) => {
        const text = subtaskInput[taskId];
        if (!text || !text.trim()) return;

        const newSubtask = { id: Date.now().toString(), text, completed: false };
        const newTasks = tasks.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t);
        setSubtaskInput({ ...subtaskInput, [taskId]: '' });
        saveToSheets(newTasks);
    };

    const toggleSubtask = (taskId, subtaskId) => {
        const newTasks = tasks.map(t => {
            if (t.id === taskId) {
                return {
                    ...t,
                    subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
                };
            }
            return t;
        });
        saveToSheets(newTasks);
    };

    const deleteSubtask = (taskId, subtaskId) => {
        const newTasks = tasks.map(t => {
            if (t.id === taskId) {
                return {
                    ...t,
                    subtasks: t.subtasks.filter(st => st.id !== subtaskId)
                };
            }
            return t;
        });
        saveToSheets(newTasks);
    };

    // Export to CSV Function
    const exportToCSV = () => {
        const headers = ['หัวข้อ', 'หมวดหมู่', 'ความสำคัญ', 'สถานะ', 'รายละเอียด', 'รายการย่อย', 'วันที่สร้าง'];
        const rows = tasks.map(t => [
            t.text,
            t.category,
            t.priority,
            t.completed ? 'เสร็จแล้ว' : 'ค้างอยู่',
            (t.description || '').replace(/,/g, ' '), 
            t.subtasks.map(s => `${s.completed ? '[x]' : '[ ]'} ${s.text}`).join(' | '),
            t.date
        ]);

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        csvContent += headers.join(",") + "\n";
        rows.forEach(row => {
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `todo_list_${new Date().toLocaleDateString('th-TH')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (filter !== 'ทั้งหมด') {
            result = result.filter(t => t.category === filter);
        }

        return [...result].sort((a, b) => {
            if (sortBy === 'priority') {
                const pMap = { 'สูง': 3, 'กลาง': 2, 'ต่ำ': 1 };
                return pMap[b.priority] - pMap[a.priority];
            }
            if (sortBy === 'completed') return (a.completed === b.completed) ? 0 : a.completed ? 1 : -1;
            
            // Safe fallback for parsing createdAt or id
            const timeA = a.createdAt ? parseInt(a.createdAt) : parseInt(a.id);
            const timeB = b.createdAt ? parseInt(b.createdAt) : parseInt(b.id);
            return timeB - timeA;
        });
    }, [tasks, filter, sortBy]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium italic">กำลังเชื่อมต่อข้อมูลจาก Google Sheets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
            <div className="max-w-3xl mx-auto">
                <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-indigo-600 flex items-center gap-2">
                            <ListTodo size={32} />
                            ระบบจัดการงาน (Google Sheets)
                        </h1>
                        <div className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full w-fit mt-1 ${saving ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {saving ? <Cloud size={14} className="animate-pulse" /> : <Cloud size={14} />} 
                            {saving ? 'กำลังอัปเดตข้อมูล...' : 'ข้อมูลซิงค์ตรงกับ Google Sheets'}
                        </div>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download size={18} /> ส่งออกสำรองเป็น CSV
                    </button>
                </header>

                {/* Form */}
                <form onSubmit={addTask} className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 mb-8">
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="หัวข้อสิ่งที่ต้องทำ..."
                            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button type="submit" disabled={saving} className={`text-white px-6 rounded-xl font-medium shadow-md ${saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="flex gap-4">
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm bg-slate-50 p-2 rounded-lg outline-none">
                            {categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="text-sm bg-slate-50 p-2 rounded-lg outline-none">
                            {priorities.map(p => <option key={p} value={p}>ความสำคัญ: {p}</option>)}
                        </select>
                    </div>
                </form>

                {/* Filter Bar */}
                <div className="flex justify-between items-center mb-6 overflow-x-auto pb-2">
                    <div className="flex gap-2">
                        {categories.map(c => (
                            <button
                                key={c}
                                onClick={() => setFilter(c)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                        <ArrowUpDown size={14} className="text-slate-400" />
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs font-bold text-slate-500 bg-transparent outline-none">
                            <option value="id">ล่าสุด</option>
                            <option value="priority">ความสำคัญ</option>
                            <option value="completed">สถานะ</option>
                        </select>
                    </div>
                </div>

                {/* Task List */}
                <div className="space-y-4 pb-20">
                    {filteredTasks.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            ยังไม่มีรายการงานในหมวดหมู่นี้
                        </div>
                    )}
                    {filteredTasks.map(task => (
                        <div key={task.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            {/* Row Header */}
                            <div
                                onClick={() => toggleExpand(task.id, task.isExpanded)}
                                className="p-4 flex items-center gap-4 cursor-pointer"
                            >
                                <button
                                    onClick={(e) => toggleComplete(task.id, task.completed, e)}
                                    className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-indigo-400'}`}
                                >
                                    {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold truncate ${task.completed ? 'line-through text-slate-300' : 'text-slate-700'}`}>
                                        {task.text}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{task.category}</span>
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="text-[10px] text-indigo-500 font-bold">
                                                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} สำเร็จ
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${task.priority === 'สูง' ? 'bg-rose-100 text-rose-600' :
                                            task.priority === 'กลาง' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {task.priority}
                                    </span>
                                    {task.isExpanded ? <ChevronUp size={20} className="text-slate-300" /> : <ChevronDown size={20} className="text-slate-300" />}
                                </div>
                            </div>

                            {/* Expansion Area */}
                            {task.isExpanded && (
                                <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100 pt-4 animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <AlignLeft size={14} /> รายละเอียดงาน
                                        </label>
                                        <textarea
                                            value={task.description || ''}
                                            onChange={(e) => updateDescriptionLocally(task.id, e.target.value)}
                                            onBlur={(e) => handleDescriptionBlur(task.id, e.target.value)}
                                            placeholder="จดบันทึกข้อมูลสำคัญที่นี่... (บันทึกอัตโนมัติเมื่อคลิกที่อื่น)"
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] resize-none"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <CheckSquare size={14} /> เช็คลิสต์ย่อย
                                        </label>
                                        <div className="space-y-2 mb-3">
                                            {task.subtasks && task.subtasks.map(sub => (
                                                <div key={sub.id} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 group">
                                                    <button
                                                        onClick={() => toggleSubtask(task.id, sub.id)}
                                                        className={sub.completed ? 'text-indigo-500' : 'text-slate-200'}
                                                    >
                                                        {sub.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                    <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                                        {sub.text}
                                                    </span>
                                                    <button
                                                        onClick={() => deleteSubtask(task.id, sub.id)}
                                                        className="text-slate-200 hover:text-rose-500 transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={subtaskInput[task.id] || ''}
                                                onChange={(e) => setSubtaskInput({ ...subtaskInput, [task.id]: e.target.value })}
                                                onKeyPress={(e) => e.key === 'Enter' && addSubtask(task.id)}
                                                placeholder="เพิ่มงานย่อย..."
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <button
                                                onClick={() => addSubtask(task.id)}
                                                className="bg-indigo-50 text-indigo-600 px-4 rounded-lg text-xs font-bold hover:bg-indigo-100"
                                            >
                                                เพิ่ม
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Sheet ID: {task.id}</span>
                                        <button
                                            onClick={(e) => deleteTask(task.id, e)}
                                            className="flex items-center gap-1 text-[10px] text-rose-500 font-black uppercase hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} /> ลบงานนี้ทิ้ง
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default App;