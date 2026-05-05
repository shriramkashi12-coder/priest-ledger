import React, { useState, useEffect } from 'react';
import { auth, db, logInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, increment, query, orderBy, limit } from 'firebase/firestore';
import { LogOut } from 'lucide-react';
import PinScreen from './PinScreen';

// --- PDF IMPORTS ---
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- DICTIONARIES & CATEGORIES ---
const dict = {
  en: {
    lblIncome: "Income", lblExpense: "Expense", lblPending: "Pending", lblPlanned: "Planned", lblRecurring: "Repeat Monthly",
    lblCategory: "Category", lblDate: "Date", lblMode: "Mode",
    optGenLedger: "General Ledger", optNewTrip: "+ New Ledger...", optAllCat: "All Categories", optAllModes: "All Modes",
    optAllPending: "All Dues", optStillPending: "Still Pending", optRecovered: "Recovered",
    placeholderDetails: "Add details or notes (optional)...", placeholderSearch: "Search notes/mode...",
    btnAdd: "Add Transaction", btnUpdate: "Update Transaction", btnCancel: "Cancel Edit",
    lblModalNotesTitle: "Notes & Details", btnCloseModal: "Close Details", txtNoNotes: "No additional notes provided.",
    txtNoRecords: "No matching records found.", txtSum: "Sum", txtAllTime: "All-Time Report", txtReport: "Report", 
    txtTotal: "Total", txtMonthly: "Monthly", txtPendingDuesBadge: "⏳ Pending Dues:", btnMarkPaid: "Mark Paid", 
    txtOriginalDate: "(Due: ", btnPayNow: "Pay Now", txtDaysLeft: "Days Left", txtDueToday: "Due Today", txtOverdue: "Overdue!",
    titleLogin: "Priest Ledger", descLogin: "Sign in to sync your ledger securely to the cloud."
  },
  ta: {
    lblIncome: "வருமானம்", lblExpense: "செலவு", lblPending: "நிலுவை", lblPlanned: "திட்டமிட்டவை", lblRecurring: "மாதாந்திரம்",
    lblCategory: "வகை", lblDate: "தேதி", lblMode: "முறை",
    optGenLedger: "பொது கணக்கு", optNewTrip: "+ புதிய கணக்கு...", optAllCat: "அனைத்து வகைகள்", optAllModes: "அனைத்து முறைகள்",
    optAllPending: "அனைத்து நிலுவை", optStillPending: "நிலுவையில் உள்ளவை", optRecovered: "பெறப்பட்டவை",
    placeholderDetails: "விவரங்கள்/குறிப்புகள் (விரும்பினால்)...", placeholderSearch: "தேடுக...",
    btnAdd: "பரிவர்த்தனை சேர்", btnUpdate: "புதுப்பி", btnCancel: "ரத்து செய்",
    lblModalNotesTitle: "விவரங்கள்", btnCloseModal: "மூடு", txtNoNotes: "குறிப்புகள் எதுவும் இல்லை.",
    txtNoRecords: "பதிவுகள் எதுவும் இல்லை.", txtSum: "மொத்தம்", txtAllTime: "முழு அறிக்கை", txtReport: "அறிக்கை", 
    txtTotal: "மொத்த", txtMonthly: "மாத", txtPendingDuesBadge: "⏳ நிலுவைத் தொகை:", btnMarkPaid: "பெறப்பட்டது", 
    txtOriginalDate: "(பழைய தேதி: ", btnPayNow: "செலுத்து", txtDaysLeft: "நாட்கள் மீதம்", txtDueToday: "இன்று தேதியாகும்", txtOverdue: "தாமதம்!",
    titleLogin: "கணக்கு புத்தகம்", descLogin: "உங்கள் தரவை மேகக்கணியில் பாதுகாப்பாக சேமிக்க உள்நுழையவும்."
  }
};

const catTranslate = {
  "Poojai": "பூஜை", "Homam": "ஹோமம்", "Purvam": "பூர்வம்", "Aparam": "அபரம்", "Laukikam": "லௌகீகம்", "Other Income": "மற்ற வருமானம்",
  "Travel": "பயணம்", "Pooja Materials": "பூஜை பொருட்கள்", "Dakshina Given": "தட்சணை", "Food/Meals": "உணவு", "Other Expense": "மற்ற செலவு"
};

const incomeCategories = ["Poojai", "Homam", "Purvam", "Aparam", "Laukikam", "Other Income"];
const expenseCategories = ["Travel", "Pooja Materials", "Dakshina Given", "Food/Meals", "Other Expense"];
const categoryIcons = { "Aparam": "🔥", "Homam": "🕉️", "Purvam": "✨", "Poojai": "🙏", "Laukikam": "💼", "Other Income": "💰", "Travel": "🚕", "Pooja Materials": "🌺", "Dakshina Given": "💸", "Food/Meals": "🍛", "Other Expense": "🧾" };

const formatCustomDate = (dateStr, langCode) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString(langCode === 'ta' ? 'ta-IN' : 'en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
};

const calculateNextMonthDate = (dateString) => {
  const d = new Date(dateString);
  const month = d.getMonth();
  d.setMonth(month + 1);
  if (d.getMonth() !== (month + 1) % 12) d.setDate(0); 
  return d.toISOString().split('T')[0];
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // App State
  const [lang, setLang] = useState(localStorage.getItem('priestLang') || 'en');
  const [transactions, setTransactions] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [trips, setTrips] = useState([{ id: 'GENERAL', name: 'General Ledger' }]);
  const [activeTripId, setActiveTripId] = useState('GENERAL');
  
  // Form State
  const [txnType, setTxnType] = useState('income');
  const [category, setCategory] = useState('');
  const [customCatInput, setCustomCatInput] = useState('');
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('Cash');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Filter State
  const [currentViewType, setCurrentViewType] = useState('monthly');
  const [filterMonth, setFilterMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL');
  const [pendingFilter, setPendingFilter] = useState('STILL_PENDING');
  const [txnLimit, setTxnLimit] = useState(100); // Only load 100 items by default

  // Modal & Security
  const [activeModalTxn, setActiveModalTxn] = useState(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // --- SUMMARY CLOUD ENGINE STATE ---
  const [activeSummary, setActiveSummary] = useState({ income: 0, expense: 0, pending: 0, planned: 0 });

  const handleForgotPin = async () => {
    if (navigator.onLine) {
      if (user && user.uid) { localStorage.removeItem(`appPin_${user.uid}`); }
      setIsLocked(true);
      await logOut(); 
    } else {
      alert("You must be connected to the internet to reset your PIN.");
    }
  };

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const t = (key) => dict[lang][key];
  const cT = (name) => (lang === 'ta' && catTranslate[name]) ? catTranslate[name] : name;

  // --- AUTH & FIRESTORE SYNC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await setDoc(doc(db, 'users', currentUser.uid), {
          email: currentUser.email, name: currentUser.displayName, lastActive: new Date().toISOString()
        }, { merge: true });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // THE QUOTA SHIELD: Query with ordering and limit
    const qTxn = query(
      collection(db, `users/${user.uid}/transactions`), 
      orderBy('date', 'desc'), 
      limit(txnLimit)
    );
    
    const unsubTxn = onSnapshot(qTxn, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qCat = collection(db, `users/${user.uid}/categories`);
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      setCustomCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qLedgers = collection(db, `users/${user.uid}/ledgers`);
    const unsubLedgers = onSnapshot(qLedgers, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips([{ id: 'GENERAL', name: t('optGenLedger') }, ...fetched]);
    });

    return () => { unsubTxn(); unsubCat(); unsubLedgers(); };
  }, [user, lang, txnLimit]);

  // --- AUTO-MIGRATION & SUMMARY LISTENER ---
  useEffect(() => {
    if (!user || !activeTripId) return;
    const summaryRef = doc(db, `users/${user.uid}/summaries`, activeTripId);
    
    const unsub = onSnapshot(summaryRef, async (docSnap) => {
      if (docSnap.exists()) {
        setActiveSummary({ income: 0, expense: 0, pending: 0, planned: 0, ...docSnap.data() });
      } else {
        // Auto-Migration: If no cloud summary exists, build it from the local data
        if (transactions.length > 0) {
          const tripTxns = transactions.filter(t => t.tripId === activeTripId);
          let sums = { income: 0, expense: 0, pending: 0, planned: 0 };
          tripTxns.forEach(t => { if (sums[t.type] !== undefined) sums[t.type] += t.amount; });
          await setDoc(summaryRef, sums);
        }
      }
    });
    return () => unsub();
  }, [user, activeTripId, transactions.length]);

  // --- SUMMARY INCREMENT HELPER ---
  const updateSummary = async (tripId, type, amountChange) => {
    if (amountChange === 0 || !tripId) return;
    const summaryRef = doc(db, `users/${user.uid}/summaries`, tripId);
    await setDoc(summaryRef, { [type]: increment(amountChange) }, { merge: true });
  };

  // --- MASTER ARCHIVE EXPORT ---
  const downloadMasterPDF = () => {
    if (!transactions.length) return alert(t('txtNoRecords'));
    const doc = new jsPDF();
    const currentYear = new Date().getFullYear();
    let currentY = 35;

    doc.setFontSize(22); doc.setTextColor(40, 40, 40); doc.text(`Complete Ledger Archive - ${currentYear}`, 14, 22);
    doc.setFontSize(11); doc.setTextColor(100, 100, 100); doc.text(`Generated on: ${formatCustomDate(new Date().toISOString(), 'en')}`, 14, 28);

    const sections = [
      { id: 'income', title: 'Direct Income', filter: t => t.type === 'income' && !t.isRecovered, color: [46, 204, 113] },
      { id: 'recovered', title: 'Recovered Dues', filter: t => t.type === 'income' && t.isRecovered, color: [39, 174, 96] },
      { id: 'expense', title: 'Expenses', filter: t => t.type === 'expense', color: [231, 76, 60] },
      { id: 'pending', title: 'Pending Dues (Unpaid)', filter: t => t.type === 'pending', color: [241, 196, 15] },
      { id: 'planned', title: 'Planned Expenses', filter: t => t.type === 'planned', color: [0, 229, 255] }
    ];

    trips.forEach((trip) => {
      const tripTxns = transactions.filter(t => t.tripId === trip.id);
      if (tripTxns.length === 0) return; 

      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(16); doc.setTextColor(237, 94, 33); doc.text(`Ledger: ${trip.name}`, 14, currentY); currentY += 10;

      sections.forEach(sec => {
        const sectionTxns = tripTxns.filter(sec.filter).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (sectionTxns.length === 0) return; 

        const sectionTotal = sectionTxns.reduce((acc, curr) => acc + curr.amount, 0);
        const tableRows = sectionTxns.map(txn => [ formatCustomDate(txn.date, 'en'), txn.category, txn.paymentMode, txn.details || '-', `Rs. ${txn.amount.toLocaleString('en-IN')}` ]);

        autoTable(doc, {
          startY: currentY, head: [[`${sec.title}`, 'Category', 'Mode', 'Details', 'Amount']], body: tableRows,
          foot: [['', '', '', 'Total:', `Rs. ${sectionTotal.toLocaleString('en-IN')}`]], theme: 'grid',
          headStyles: { fillColor: sec.color, textColor: [255,255,255] }, footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 28 }, 4: { halign: 'right', fontStyle: 'bold', cellWidth: 35 } }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      });
      currentY += 5; doc.setDrawColor(200); doc.line(14, currentY, 196, currentY); currentY += 15;
    });
    doc.save(`Complete_Ledger_Archive_${currentYear}.pdf`);
  };

  const todayDate = new Date();
  const currentMonth = todayDate.getMonth();
  const currentDay = todayDate.getDate();
  const showYearEndWarning = (currentMonth === 2 && currentDay >= 15 && currentDay <= 31); 

  // --- DERIVED DATA FOR UI VIEWS ---
  let contextTransactions = [];
  if (txnType === 'pending') {
    if (pendingFilter === 'STILL_PENDING') contextTransactions = transactions.filter(e => e.tripId === activeTripId && e.type === 'pending');
    else if (pendingFilter === 'RECOVERED') contextTransactions = transactions.filter(e => e.tripId === activeTripId && e.type === 'income' && e.isRecovered === true);
    else if (pendingFilter === 'ALL') contextTransactions = transactions.filter(e => e.tripId === activeTripId && (e.type === 'pending' || (e.type === 'income' && e.isRecovered === true)));
  } else {
    contextTransactions = transactions.filter(e => e.tripId === activeTripId && e.type === txnType);
  }

  if (currentViewType === 'monthly' && filterMonth) {
    const [y, m] = filterMonth.split('-');
    contextTransactions = contextTransactions.filter(e => {
      const d = new Date(e.date); 
      return d.getMonth() + 1 === parseInt(m) && d.getFullYear() === parseInt(y);
    });
  }

  let filteredTransactions = contextTransactions;
  if (filterCategory !== 'ALL') filteredTransactions = filteredTransactions.filter(e => e.category === filterCategory);
  if (filterMode !== 'ALL') filteredTransactions = filteredTransactions.filter(e => e.paymentMode === filterMode);
  if (searchQuery) filteredTransactions = filteredTransactions.filter(e => cT(e.category).toLowerCase().includes(searchQuery.toLowerCase()) || (e.details && e.details.toLowerCase().includes(searchQuery.toLowerCase())));

  const displayTotal = filteredTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  // 🚀 MAGIC HAPPENS HERE: Reading from Cloud Summary instead of Local Array
  let headerTotal = 0;
  if (currentViewType === 'monthly' || (txnType === 'pending' && pendingFilter !== 'STILL_PENDING')) {
     headerTotal = contextTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  } else {
     headerTotal = activeSummary[txnType] || 0;
  }
  const globalPendingTotal = activeSummary['pending'] || 0;

  // --- FORM HANDLERS (WITH TRACKER INTEGRATION) ---
  const handleTripChange = async (e) => {
    if (e.target.value === 'ADD_NEW_TRIP') {
      const name = prompt(lang === 'ta' ? "புதிய கணக்கின் பெயரை உள்ளிடவும்:" : "Enter name for new ledger:");
      if (name && name.trim() !== '') {
         const res = await addDoc(collection(db, `users/${user.uid}/ledgers`), { name: name.trim() });
         setActiveTripId(res.id);
      }
    } else {
      setActiveTripId(e.target.value);
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return alert("Enter valid amount");
    let finalCat = isCustomCat ? customCatInput.trim() : category;
    if (!finalCat || finalCat === 'ADD_NEW_CUSTOM_CAT') return alert("Select or type a category");

    const categoryType = (txnType === 'expense' || txnType === 'planned') ? 'expense' : 'income';

    if (isCustomCat) {
      const existing = customCategories.find(c => c.name.toLowerCase() === finalCat.toLowerCase() && c.type === txnType && c.tripId === activeTripId);
      if (!existing) await addDoc(collection(db, `users/${user.uid}/categories`), { name: finalCat, type: txnType, tripId: activeTripId });
    }

    const payload = { tripId: activeTripId, type: txnType, category: finalCat, details, amount: parseFloat(amount), date, paymentMode: mode, isRecurring };

    if (editingId) {
      const oldTxn = transactions.find(t => t.id === editingId);
      if (oldTxn) await updateSummary(oldTxn.tripId, oldTxn.type, -oldTxn.amount);
      await updateDoc(doc(db, `users/${user.uid}/transactions`, editingId), payload);
      await updateSummary(activeTripId, txnType, parseFloat(amount));
      cancelEdit();
    } else {
      await addDoc(collection(db, `users/${user.uid}/transactions`), payload);
      await updateSummary(activeTripId, txnType, parseFloat(amount));
      setAmount(''); setDetails(''); setIsCustomCat(false); setCustomCatInput(''); setCategory(finalCat);
    }
  };

  const handleEdit = (txn) => {
    setTxnType(txn.type); setCategory(txn.category); setAmount(txn.amount.toString());
    setDate(txn.date); setMode(txn.paymentMode || 'Cash'); setDetails(txn.details || '');
    setIsRecurring(txn.isRecurring || false); setEditingId(txn.id); setIsCustomCat(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(null); setAmount(''); setDetails(''); setDate(new Date().toISOString().split('T')[0]); setIsCustomCat(false); setCustomCatInput(''); };

  const handleDelete = async (id) => {
    if (confirm("Delete this transaction?")) {
      const txn = transactions.find(t => t.id === id);
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, id));
      if (txn) await updateSummary(txn.tripId, txn.type, -txn.amount);
      if (editingId === id) cancelEdit();
    }
  };

  const handleDeleteCustomCategory = async (catId, catName) => {
    if (confirm(`Delete custom category "${catName}"?\n(Past transactions using this category will not be deleted).`)) {
      await deleteDoc(doc(db, `users/${user.uid}/categories`, catId));
      setCategory('');
    }
  };

  // --- ADVANCED ACTIONS (WITH TRACKER INTEGRATION) ---
  const markAsPaid = async (txn) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const historyNote = `${t('txtOriginalDate')}${formatCustomDate(txn.date, lang)})`;
    await updateDoc(doc(db, `users/${user.uid}/transactions`, txn.id), {
      type: 'income', isRecovered: true, originalDate: txn.date, date: todayStr, details: txn.details ? `${txn.details} ${historyNote}` : historyNote
    });
    await updateSummary(txn.tripId, 'pending', -txn.amount);
    await updateSummary(txn.tripId, 'income', txn.amount);
    setTxnType('income');
  };

  const undoRecover = async (txn) => {
    const oldDate = txn.originalDate || txn.date;
    const historyNote = `${t('txtOriginalDate')}${formatCustomDate(oldDate, lang)})`;
    let cleanDetails = txn.details || '';
    if (cleanDetails.includes(historyNote)) cleanDetails = cleanDetails.replace(historyNote, '').trim();
    
    await updateDoc(doc(db, `users/${user.uid}/transactions`, txn.id), { type: 'pending', isRecovered: false, date: oldDate, details: cleanDetails });
    await updateSummary(txn.tripId, 'income', -txn.amount);
    await updateSummary(txn.tripId, 'pending', txn.amount);
    setTxnType('pending'); setPendingFilter('STILL_PENDING');
  };

  const payPlanned = async (txn) => {
    const d = new Date();
    const todayStr = d.toISOString().split('T')[0];
    const historyNote = `${t('txtOriginalDate')}${formatCustomDate(txn.date, lang)})`;

    if (txn.isRecurring) {
      await addDoc(collection(db, `users/${user.uid}/transactions`), { ...txn, type: 'expense', date: todayStr, isRecurring: false, details: txn.details ? `${txn.details} ${historyNote}` : historyNote });
      await updateDoc(doc(db, `users/${user.uid}/transactions`, txn.id), { date: calculateNextMonthDate(txn.date) });
      await updateSummary(txn.tripId, 'expense', txn.amount);
    } else {
      await updateDoc(doc(db, `users/${user.uid}/transactions`, txn.id), { type: 'expense', date: todayStr, details: txn.details ? `${txn.details} ${historyNote}` : historyNote });
      await updateSummary(txn.tripId, 'planned', -txn.amount);
      await updateSummary(txn.tripId, 'expense', txn.amount);
    }
    setTxnType('expense');
  };

  const copyToWhatsApp = () => {
    const listToCopy = filteredTransactions;
    if (!listToCopy.length) return alert(t('txtNoRecords'));
    let total = 0;
    let txt = `*Ledger:* ${trips.find(t => t.id === activeTripId)?.name || 'General'}\n*Type:* ${t(txnType === 'income'?'lblIncome':txnType==='expense'?'lblExpense':txnType==='pending'?'lblPending':'lblPlanned').toUpperCase()}\n\n`;
    listToCopy.forEach(e => {
      total += e.amount;
      txt += `• ${formatCustomDate(e.date, lang)} | *${cT(e.category)}* | ₹${e.amount.toLocaleString('en-IN')}${e.details?`\n  ↳ _${e.details}_`:''}\n`;
    });
    txt += `\n*TOTAL: ₹${total.toLocaleString('en-IN')}*`;
    navigator.clipboard.writeText(txt).then(() => alert(t('txtCopied')));
  };

  const activeColor = txnType === 'income' ? 'var(--income)' : txnType === 'expense' ? 'var(--expense)' : txnType === 'pending' ? 'var(--pending)' : 'var(--planned)';
  const baseCategoryType = (txnType === 'expense' || txnType === 'planned') ? 'expense' : 'income';
  const activeOptions = baseCategoryType === 'expense' ? expenseCategories : incomeCategories;
  
  const activeCustomCats = customCategories.filter(c => (c.type === txnType || (!c.tripId && c.type === baseCategoryType)) && (c.tripId === activeTripId || !c.tripId));
  const selectedCustomCatData = activeCustomCats.find(c => c.name === category);
  const isGhostCategory = editingId && category && !activeOptions.includes(category) && !activeCustomCats.find(c => c.name === category);

  const today = new Date(); today.setHours(0,0,0,0);
  const alerts = transactions.filter(e => e.tripId === activeTripId && e.type === 'planned').filter(entry => {
    const dueDate = new Date(entry.date); dueDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const getReportMonthStr = () => {
    if (!filterMonth) return '';
    const rDate = new Date(filterMonth + '-01');
    const rMonth = rDate.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long' });
    return `${rMonth} / ${rDate.getFullYear()}`;
  };

  // --- RENDER ---
  if (loading) return <div className="login-screen" style={{color: 'white'}}>Loading...</div>;

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 style={{fontSize: '32px', color: 'var(--orange-grad-end)', margin: '0 0 10px'}}>{t('titleLogin')}</h1>
          <p style={{color: 'var(--text-dim)', marginBottom: '30px'}}>{t('descLogin')}</p>
          <button className="google-btn" onClick={logInWithGoogle}>
            <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }
  
  if (isLocked) { return <PinScreen userId={user.uid} onUnlock={() => setIsLocked(false)} onReset={handleForgotPin} />; }

  return (
    <>
      {activeModalTxn && (
        <div className="overlay-backdrop">
          <div className="modal-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{margin:0, fontSize:'22px', color:'white'}}>{cT(activeModalTxn.category)}</h3>
              <span style={{fontSize:'20px', fontWeight:700, color: activeModalTxn.type==='income'?'var(--income)':activeModalTxn.type==='expense'?'var(--expense)':activeModalTxn.type==='pending'?'var(--pending)':'var(--planned)'}}>
                {activeModalTxn.type==='income'?'+':activeModalTxn.type==='expense'?'-':activeModalTxn.type==='pending'?'⏳':'🗓️'}₹{activeModalTxn.amount.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{color:'var(--text-dim)', fontSize:'14px', marginBottom:'20px'}}>
              {formatCustomDate(activeModalTxn.date, lang)}
              &nbsp;&bull; <strong style={{color:'white'}}>{activeModalTxn.paymentMode}</strong>
              {activeModalTxn.isRecovered && <>&nbsp;&bull; <strong style={{color:'var(--income)'}}>✅ Recovered</strong></>}
              {activeModalTxn.isRecurring && <>&nbsp;&bull; <strong style={{color:'var(--planned)'}}>🔄 {t('lblRecurring')}</strong></>}
            </div>
            <label style={{fontSize:'11px', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700}}>{t('lblModalNotesTitle')}</label>
            <div style={{background:'#222', padding:'15px', borderRadius:'12px', color:activeModalTxn.details?'white':'var(--text-dim)', fontStyle:activeModalTxn.details?'normal':'italic', marginTop:'5px'}}>
              {activeModalTxn.details || t('txtNoNotes')}
            </div>
            <button className="btn-cancel" style={{display:'block', width:'100%', marginTop:'25px'}} onClick={() => setActiveModalTxn(null)}>{t('btnCloseModal')}</button>
          </div>
        </div>
      )}

      {showYearEndWarning && (
        <div style={{ background: 'var(--pending)', color: '#000', padding: '10px 15px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
          ⚠️ Year-End Reminder: Export your Master Archive to save {new Date().getFullYear()}'s records.
        </div>
      )}

      {isOffline && (
        <div style={{ background: '#ff3b30', color: 'white', textAlign: 'center', padding: '4px', fontSize: '12px', fontWeight: 'bold' }}>
          ⚠️ You are offline. Viewing saved data.
        </div>
      )}

      <div className="top-header">
        <div className="nav-top">
          <select className="folder-select" value={activeTripId} onChange={handleTripChange}>
            {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="ADD_NEW_TRIP" style={{color: '#00e5ff'}}>{t('optNewTrip')}</option>
          </select>
        </div>

        <div className="balance-container">
          <div className="balance-label">{currentViewType==='monthly'?t('txtMonthly'):t('txtTotal')} {t(txnType === 'income'?'lblIncome':txnType==='expense'?'lblExpense':txnType==='pending'?'lblPending':'lblPlanned')}</div>
          <div className="balance-amount" style={{color: activeColor}}>₹{headerTotal.toLocaleString('en-IN')}</div>
          {txnType !== 'pending' && txnType !== 'planned' && (
            <div className="pending-badge" onClick={() => setTxnType('pending')}>
              <span>{t('txtPendingDuesBadge')}</span> ₹{globalPendingTotal.toLocaleString('en-IN')}
            </div>
          )}
        </div>

        <div className="action-bar">
          <div className="action-circle-btn dark" onClick={() => {setCurrentViewType('all'); setFilterMonth('');}} title="All-Time">📜</div>
          <div className="action-circle-btn dark" onClick={copyToWhatsApp} title="Copy to WhatsApp">📋</div>
          <div className="action-circle-btn dark" onClick={downloadMasterPDF} title="Download Master Archive PDF" style={{color: '#00e5ff'}}>📥</div>
          <div className="action-circle-btn dark" onClick={() => setLang(lang==='en'?'ta':'en')} style={{color:'#ed5e21'}}>அ/A</div>
          <div className="action-circle-btn dark" onClick={logOut} style={{color:'var(--expense)'}}><LogOut size={18}/></div>
        </div>
      </div>

      <div className="form-container">
        <div className="type-toggle">
          {['income', 'expense', 'pending', 'planned'].map((type, idx) => (
            <div key={type} onClick={() => {setTxnType(type); cancelEdit();}} style={{color: txnType === type ? `var(--${type})` : 'var(--text-dim)'}}>
              {t(type === 'income'?'lblIncome':type==='expense'?'lblExpense':type==='pending'?'lblPending':'lblPlanned')}
            </div>
          ))}
          <div className="toggle-slider" style={{transform: `translateX(${['income','expense','pending','planned'].indexOf(txnType) * 100}%)`}}></div>
        </div>

        <div className="input-row">
          <div className="input-group" style={{flex: 1.5}}>
            <div className="label-header">
              <label>{t('lblCategory')}</label>
              {isCustomCat && <span style={{color:'var(--expense)', fontSize:'10px', fontWeight:800, cursor:'pointer', textTransform:'uppercase'}} onClick={() => {setIsCustomCat(false); setCustomCatInput('');}}>✕ Cancel</span>}
            </div>
            {!isCustomCat ? (
              <>
                <select value={category} onChange={(e) => { if(e.target.value === 'ADD_NEW_CUSTOM_CAT') setIsCustomCat(true); else setCategory(e.target.value); }}>
                  <option value="" disabled hidden>Select...</option>
                  {activeOptions.map(cat => <option key={cat} value={cat}>{cT(cat)}</option>)}
                  {activeCustomCats.length > 0 && <optgroup label="Custom Categories">{activeCustomCats.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</optgroup>}
                  {isGhostCategory && <option value={category} style={{fontStyle: 'italic'}}>{category} (Deleted)</option>}
                  <option value="ADD_NEW_CUSTOM_CAT">➕ {lang === 'ta' ? "தனிப்பயன் சேர்..." : "Add Custom..."}</option>
                </select>
                {selectedCustomCatData && (
                  <div style={{fontSize: '10px', color: 'var(--expense)', marginTop: '6px', cursor: 'pointer', textAlign: 'right'}} onClick={() => handleDeleteCustomCategory(selectedCustomCatData.id, selectedCustomCatData.name)}>🗑️ Delete Category</div>
                )}
              </>
            ) : (
              <input type="text" placeholder="Type new category..." value={customCatInput} onChange={e => setCustomCatInput(e.target.value)} autoFocus style={{background: 'transparent', color: 'white', border: 'none', outline: 'none', width: '100%'}} />
            )}
          </div>
          <div className="input-group">
            <div className="label-header"><label>{t('lblDate')}</label></div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {txnType === 'planned' && (
          <div className="input-row">
            <div className="input-group" style={{flexDirection: 'row', alignItems: 'center', gap: '10px', background: 'rgba(0,229,255,0.05)', borderColor: 'rgba(0,229,255,0.2)'}}>
              <input type="checkbox" id="isRec" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
              <label htmlFor="isRec" style={{fontSize: '14px', color: 'white', textTransform: 'none', cursor: 'pointer', flex: 1}}>{t('lblRecurring')}</label>
            </div>
          </div>
        )}

        <div className="input-row">
          <div className="input-group" style={{flex: 0.8}}>
            <div className="label-header"><label>{t('lblMode')}</label></div>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="GPay">GPay</option>
            </select>
          </div>
          <input type="text" className="details-input" style={{flex: 1.5}} placeholder={t('placeholderDetails')} value={details} onChange={e => setDetails(e.target.value)} />
        </div>

        <div className="input-group" style={{background: 'transparent', border: 'none', padding: 0}}>
          <input type="number" placeholder="₹ 0.00" value={amount} onChange={e => setAmount(e.target.value)} style={{background: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '18px', fontSize: '24px', textAlign: 'center'}}/>
        </div>

        <button className="btn-add" style={{background: activeColor, color: (txnType==='pending'||txnType==='planned')?'#000':'#fff'}} onClick={handleSave}>{editingId ? t('btnUpdate') : t('btnAdd')}</button>
        {editingId && <button className="btn-cancel" style={{display:'block'}} onClick={cancelEdit}>{t('btnCancel')}</button>}
      </div>

      <div className="transactions">
        {(txnType === 'income' || txnType === 'expense') && alerts.length > 0 && (
          <div className="pulse-alert-container">
            {alerts.map(entry => {
              const dDate = new Date(entry.date); dDate.setHours(0,0,0,0);
              const dDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const tTxt = dDays > 0 ? `🔥 ${dDays} ${t('txtDaysLeft')}` : dDays === 0 ? `🚨 ${t('txtDueToday')}` : `⚠️ ${t('txtOverdue')}`;
              return (
                <div key={entry.id} className="pulse-card">
                  <div style={{flex: 1}}>
                    <div style={{fontSize: '14px', fontWeight: 700, color: 'white'}}>{entry.isRecurring?'🔄 ':'🗓️ '}{cT(entry.category)} • ₹{entry.amount.toLocaleString('en-IN')}</div>
                    {entry.details && <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', fontStyle: 'italic'}}>"{entry.details}"</div>}
                    <div style={{fontSize: '12px', color: 'var(--planned)', marginTop: '6px', fontWeight: 600}}>{tTxt}</div>
                  </div>
                  <button className="action-btn-text cyan" onClick={() => payPlanned(entry)}>💳 {t('btnPayNow')}</button>
                </div>
              )
            })}
          </div>
        )}

        {txnType === 'pending' && (
          <div className="filter-row" style={{marginBottom: '10px'}}>
             <select className="filter-input" style={{flex: 1, color: pendingFilter === 'RECOVERED' ? 'var(--income)' : 'var(--pending)', fontWeight: 700}} value={pendingFilter} onChange={e => setPendingFilter(e.target.value)}>
                <option value="STILL_PENDING" style={{color: 'white'}}>⏳ Still Pending</option>
                <option value="RECOVERED" style={{color: 'white'}}>✅ Recovered Dues</option>
                <option value="ALL" style={{color: 'white'}}>📜 All Dues History</option>
             </select>
          </div>
        )}

        <div className="filter-row">
          <input type="search" className="filter-input" style={{flex: 1}} placeholder={t('placeholderSearch')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="filter-row" style={{marginBottom: '20px'}}>
          <select className="filter-input" style={{flex: 1.2}} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="ALL">{t('optAllCat')}</option>
            {activeOptions.map(cat => <option key={cat} value={cat}>{cT(cat)}</option>)}
            {activeCustomCats.length > 0 && <optgroup label="Custom Categories">{activeCustomCats.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</optgroup>}
          </select>
          <select className="filter-input" style={{flex: 1}} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="ALL">{t('optAllModes')}</option>
            <option value="Cash">Cash</option><option value="GPay">GPay</option>
          </select>
          <input type="month" className="filter-input" style={{flex: 1.2}} value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setCurrentViewType(e.target.value ? 'monthly' : 'all');}} />
        </div>
        
        <div className="txn-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%'}}>
          <div><span>{currentViewType==='monthly' && filterMonth ? getReportMonthStr() + ' ' + t('txtReport') : t('txtAllTime')}</span> <span style={{fontSize:'12px', fontWeight:400, color:'var(--text-dim)'}}>({filteredTransactions.length})</span></div>
          <div style={{color:activeColor, fontWeight:700, fontSize:'15px'}}>{t('txtSum')}: ₹{displayTotal.toLocaleString('en-IN')}</div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div style={{textAlign:'center', padding:'30px 0', color:'var(--text-dim)'}}>{t('txtNoRecords')}</div>
        ) : (
          filteredTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => {
             const isInc = entry.type === 'income'; const isPend = entry.type === 'pending'; const isPlan = entry.type === 'planned';
             const isRecov = entry.isRecovered === true;
             
             const rClass = isRecov ? 'green-glow' : isInc ? 'green-glow' : isPend ? 'yellow-glow' : isPlan ? 'cyan-glow' : 'red-glow';
             const cColor = isRecov ? 'color-green' : isInc ? 'color-green' : isPend ? 'color-yellow' : isPlan ? 'color-cyan' : 'color-red';
             const sign = isRecov ? '✅ ' : isInc ? '+' : isPend ? '⏳ ' : isPlan ? '🗓️ ' : '-';
             const dynamicStyle = isRecov ? { background: 'linear-gradient(90deg, rgba(0, 211, 98, 0.08) 0%, #111 100%)', border: '1px solid rgba(0,211,98,0.2)' } : {};

             return (
               <div key={entry.id} className={`txn-row ${rClass}`} style={dynamicStyle}>
                 <div className="txn-left" onClick={() => setActiveModalTxn(entry)} style={{ overflow: 'hidden', flex: 1 }}>
                   <div className="txn-icon">{categoryIcons[entry.category] || "🔹"}</div>
                   <div className="txn-details" style={{ width: '100%' }}>
                     <div className="txn-name">{cT(entry.category)} {entry.isRecurring && <span className="txn-subtext" style={{color:'var(--planned)'}}>🔄</span>}</div>
                     {entry.details && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.details}</div>}
                     <div className="txn-time">{formatCustomDate(entry.date, lang)} {isRecov && <span style={{color: 'var(--income)', fontWeight: 'bold', marginLeft: '6px'}}>✅ Recovered</span>}</div>
                   </div>
                 </div>
                 <div className="txn-right">
                   <div className={`txn-amt ${cColor}`}>{sign}₹{entry.amount.toLocaleString('en-IN')}</div>
                   <div className="txn-actions" style={{alignItems:'center'}}>
                     {isPend && !isRecov && <button className="action-btn-text" onClick={() => markAsPaid(entry)}>💰 {t('btnMarkPaid')}</button>}
                     {isPlan && <button className="action-btn-text cyan" onClick={() => payPlanned(entry)}>💳 {t('btnPayNow')}</button>}
                     {isRecov && <button className="action-btn-text" onClick={() => undoRecover(entry)}>↩️ Undo</button>}
                     <button className="action-icon" onClick={() => handleEdit(entry)}>✎</button>
                     <button className="action-icon" onClick={() => handleDelete(entry.id)}>✕</button>
                   </div>
                 </div>
               </div>
             );
          })
        )}

        {/* --- LOAD MORE BUTTON --- */}
        {filteredTransactions.length >= txnLimit && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '30px' }}>
            <button 
              onClick={() => setTxnLimit(prev => prev + 100)} 
              className="btn-cancel" 
              style={{ padding: '10px 20px', background: '#222', color: '#00e5ff', border: '1px solid rgba(0,229,255,0.3)' }}
            >
              ⬇ Load Older Transactions ⬇
            </button>
          </div>
        )}

      </div>
    </>
  );
}
