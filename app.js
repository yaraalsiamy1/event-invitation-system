/* ==========================================================================
   Event Invitation & QR Entry System - Core Application Logic
   ========================================================================== */

// --- Default State & Sample Data ---
const DEFAULT_EVENT = {
    title: "حفل زفاف عبدالمجيد و سارة",
    date: "2026-10-25",
    time: "20:00",
    location: "قاعة الفخامة والمؤتمرات - الرياض",
    mapLink: "https://maps.google.com",
    cardImage: null
};

const SAMPLE_GUESTS = [
    {
        id: "g_1",
        name: "عبدالله المحمد",
        phone: "966501234567",
        status: "accepted", // accepted, declined, pending
        companions: 2,
        ticketCode: "EV-897412",
        checkedIn: false,
        checkInTime: null
    },
    {
        id: "g_2",
        name: "خالد العتيبي",
        phone: "966559876543",
        status: "pending",
        companions: 1,
        ticketCode: "EV-654321",
        checkedIn: false,
        checkInTime: null
    },
    {
        id: "g_3",
        name: "فهد الدوسري",
        phone: "966541112233",
        status: "declined",
        companions: 1,
        ticketCode: "EV-112233",
        checkedIn: false,
        checkInTime: null
    },
    {
        id: "g_4",
        name: "د. سارة الشمري",
        phone: "966567778899",
        status: "accepted",
        companions: 3,
        ticketCode: "EV-778899",
        checkedIn: true,
        checkInTime: "08:15 مساءً"
    }
];

class EventApp {
    constructor() {
        this.eventData = JSON.parse(localStorage.getItem('qr_event_data')) || DEFAULT_EVENT;
        this.guests = JSON.parse(localStorage.getItem('qr_event_guests')) || SAMPLE_GUESTS;
        this.gateLogs = JSON.parse(localStorage.getItem('qr_event_gate_logs')) || [];
        this.activeGuestId = this.guests[0]?.id || null;
        this.qrCodeInstance = null;
        this.html5QrCode = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderEventDetails();
        this.renderStats();
        this.renderGuestsTable();
        this.populateGuestSimulatorDropdown();
        this.renderGuestView();
        this.renderGateLogs();
    }

    // Save persistent state
    saveState() {
        localStorage.setItem('qr_event_data', JSON.stringify(this.eventData));
        localStorage.setItem('qr_event_guests', JSON.stringify(this.guests));
        localStorage.setItem('qr_event_gate_logs', JSON.stringify(this.gateLogs));
        this.renderStats();
    }

    bindEvents() {
        // Navigation View Switcher
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetViewId = btn.getAttribute('data-target');
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active-view'));
                
                btn.classList.add('active');
                document.getElementById(targetViewId).classList.add('active-view');

                if (targetViewId === 'guest-view') {
                    this.renderGuestView();
                }
            });
        });

        // Event Form Submit
        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.eventData.title = document.getElementById('event-title').value;
            this.eventData.date = document.getElementById('event-date').value;
            this.eventData.time = document.getElementById('event-time').value;
            this.eventData.location = document.getElementById('event-location').value;
            this.eventData.mapLink = document.getElementById('event-map-link').value;
            this.saveState();
            this.renderEventDetails();
            alert('تم حفظ تفاصيل المناسبة بنجاح!');
        });

        // Image Upload for Invitation Card
        document.getElementById('card-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.eventData.cardImage = event.target.result;
                    this.saveState();
                    this.renderCardPreview();
                    this.renderGuestView();
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset Card Image
        document.getElementById('btn-reset-card').addEventListener('click', () => {
            this.eventData.cardImage = null;
            this.saveState();
            this.renderCardPreview();
            this.renderGuestView();
        });

        // Add Batch Guests Form
        document.getElementById('add-guests-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processBatchGuestInput();
        });

        // Load Sample Guests Button
        document.getElementById('btn-load-sample').addEventListener('click', () => {
            this.guests = [...SAMPLE_GUESTS];
            this.saveState();
            this.renderGuestsTable();
            this.populateGuestSimulatorDropdown();
            this.renderGuestView();
        });

        // Clear All Guests Button
        document.getElementById('btn-clear-all').addEventListener('click', () => {
            if (confirm('هل أنت تأكد من مسح جميع المدعوين؟')) {
                this.guests = [];
                this.gateLogs = [];
                this.saveState();
                this.renderGuestsTable();
                this.populateGuestSimulatorDropdown();
                this.renderGuestView();
                this.renderGateLogs();
            }
        });

        // Simulator Dropdown Selector
        document.getElementById('guest-select-simulator').addEventListener('change', (e) => {
            this.activeGuestId = e.target.value;
            this.renderGuestView();
        });

        // Guest RSVP Accept
        document.getElementById('btn-rsvp-accept').addEventListener('click', () => {
            this.handleGuestRSVP('accepted');
        });

        // Guest RSVP Decline
        document.getElementById('btn-rsvp-decline').addEventListener('click', () => {
            this.handleGuestRSVP('declined');
        });

        // Guest Change RSVP
        document.getElementById('btn-change-rsvp').addEventListener('click', () => {
            const guest = this.getGuest(this.activeGuestId);
            if (guest) {
                guest.status = 'pending';
                this.saveState();
                this.renderGuestView();
                this.renderGuestsTable();
            }
        });

        // Download Ticket Image Simulation
        document.getElementById('btn-download-ticket').addEventListener('click', () => {
            alert('جاري تجهيز وتنزيل بطاقة الدخول الذكية بجودة عالية للجوال...');
        });

        // Gate Scanner Manual Check
        document.getElementById('btn-check-manual').addEventListener('click', () => {
            const inputVal = document.getElementById('manual-ticket-input').value.trim();
            if (inputVal) {
                this.processGateCheckIn(inputVal);
            }
        });

        document.getElementById('manual-ticket-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const inputVal = document.getElementById('manual-ticket-input').value.trim();
                if (inputVal) {
                    this.processGateCheckIn(inputVal);
                }
            }
        });

        // Camera Scanner Toggle
        document.getElementById('btn-toggle-camera').addEventListener('click', () => {
            this.toggleCameraScanner();
        });
    }

    // Format Phone to 966 standard for WhatsApp
    formatPhone(phoneRaw) {
        let clean = phoneRaw.replace(/\D/g, '');
        if (clean.startsWith('05')) {
            clean = '966' + clean.substring(1);
        } else if (clean.startsWith('5')) {
            clean = '966' + clean;
        }
        return clean;
    }

    generateTicketCode() {
        return 'EV-' + Math.floor(100000 + Math.random() * 900000);
    }

    getGuest(id) {
        return this.guests.find(g => g.id === id);
    }

    // Render Form & Previews
    renderEventDetails() {
        document.getElementById('event-title').value = this.eventData.title;
        document.getElementById('event-date').value = this.eventData.date;
        document.getElementById('event-time').value = this.eventData.time;
        document.getElementById('event-location').value = this.eventData.location;
        document.getElementById('event-map-link').value = this.eventData.mapLink;
        this.renderCardPreview();
    }

    renderCardPreview() {
        const previewContainer = document.getElementById('card-image-preview');
        if (this.eventData.cardImage) {
            previewContainer.innerHTML = `<img src="${this.eventData.cardImage}" alt="Event Card">`;
        } else {
            previewContainer.innerHTML = `
                <div class="default-card-graphic">
                    <i class="fa-solid fa-scroll gold-icon"></i>
                    <p>كرت الدعوة المعين حالياً</p>
                </div>
            `;
        }
    }

    renderStats() {
        const total = this.guests.length;
        const accepted = this.guests.filter(g => g.status === 'accepted').length;
        const declined = this.guests.filter(g => g.status === 'declined').length;
        const pending = this.guests.filter(g => g.status === 'pending').length;
        const checkedin = this.guests.filter(g => g.checkedIn).length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-accepted').textContent = accepted;
        document.getElementById('stat-declined').textContent = declined;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-checkedin').textContent = checkedin;
    }

    // Process Batch Guest Input
    processBatchGuestInput() {
        const rawText = document.getElementById('batch-input').value.trim();
        if (!rawText) return;

        const lines = rawText.split('\n');
        let addedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',');
            let name = "";
            let phoneRaw = "";

            if (parts.length >= 2) {
                name = parts[0].trim();
                phoneRaw = parts[1].trim();
            } else {
                phoneRaw = parts[0].trim();
                name = "ضيف عزيز";
            }

            if (phoneRaw) {
                const phoneFormatted = this.formatPhone(phoneRaw);
                this.guests.push({
                    id: "g_" + Date.now() + "_" + Math.floor(Math.random()*1000),
                    name: name || "ضيف عزيز",
                    phone: phoneFormatted,
                    status: "pending",
                    companions: 1,
                    ticketCode: this.generateTicketCode(),
                    checkedIn: false,
                    checkInTime: null
                });
                addedCount++;
            }
        });

        document.getElementById('batch-input').value = "";
        this.saveState();
        this.renderGuestsTable();
        this.populateGuestSimulatorDropdown();
        this.renderGuestView();

        alert(`تم إضافة ${addedCount} مدعو بنجاح!`);
    }

    // Render Admin Guests Table
    renderGuestsTable() {
        const tbody = document.getElementById('guests-table-body');
        tbody.innerHTML = '';

        if (this.guests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 25px; color: var(--text-muted);">لا يوجد مدعوين حتى الآن. قم بلمس "إضافة المدعوين" أعلاه.</td></tr>`;
            return;
        }

        this.guests.forEach((guest, index) => {
            const tr = document.createElement('tr');
            
            // WhatsApp Message Text
            const waMsg = encodeURIComponent(
                `مرحباً ${guest.name}\nيسرنا دعوتكم لحضور ${this.eventData.title}.\nيرجى تأكيد حضورك واستلام تذكرة الـ QR عبر الرابط التالي:\n` + window.location.href
            );
            const waUrl = `https://wa.me/${guest.phone}?text=${waMsg}`;

            let statusBadge = '';
            if (guest.status === 'accepted') {
                statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> مقبول (${guest.companions})</span>`;
            } else if (guest.status === 'declined') {
                statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> معتذر</span>`;
            } else {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> بانتظار الرد</span>`;
            }

            let checkinBadge = guest.checkedIn 
                ? `<span class="badge badge-success"><i class="fa-solid fa-user-check"></i> تم الحضور (${guest.checkInTime})</span>`
                : `<span class="badge badge-ghost" style="color:var(--text-muted);">لم يحضر بعد</span>`;

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${guest.name}</strong></td>
                <td><span dir="ltr">${guest.phone}</span></td>
                <td>${statusBadge}</td>
                <td><code>${guest.ticketCode}</code></td>
                <td>${checkinBadge}</td>
                <td>
                    <a href="${waUrl}" target="_blank" class="btn btn-sm btn-whatsapp">
                        <i class="fa-brands fa-whatsapp"></i> إرسال للدعوة
                    </a>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline btn-preview-guest" data-id="${guest.id}">
                        <i class="fa-solid fa-eye"></i> معاينة
                    </button>
                    <button class="btn btn-sm btn-ghost btn-delete-guest" data-id="${guest.id}" style="color: #ef4444;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Add action listeners
        document.querySelectorAll('.btn-preview-guest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                this.activeGuestId = id;
                document.querySelector('.nav-btn[data-target="guest-view"]').click();
            });
        });

        document.querySelectorAll('.btn-delete-guest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                if (confirm('هل ترغب بحذف هذا المدعو؟')) {
                    this.guests = this.guests.filter(g => g.id !== id);
                    this.saveState();
                    this.renderGuestsTable();
                    this.populateGuestSimulatorDropdown();
                    if (this.activeGuestId === id) {
                        this.activeGuestId = this.guests[0]?.id || null;
                    }
                    this.renderGuestView();
                }
            });
        });
    }

    // Populate Simulator Dropdown
    populateGuestSimulatorDropdown() {
        const select = document.getElementById('guest-select-simulator');
        select.innerHTML = '';

        if (this.guests.length === 0) {
            select.innerHTML = '<option value="">(لا يوجد مدعوين)</option>';
            return;
        }

        this.guests.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = `${g.name} (${g.phone}) - [${g.status === 'accepted' ? 'مقبول' : g.status === 'declined' ? 'معتذر' : 'بانتظار'}]`;
            if (g.id === this.activeGuestId) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // Render Guest Mobile Portal View
    renderGuestView() {
        const guest = this.getGuest(this.activeGuestId);
        
        // Populate Event Text
        document.getElementById('display-event-title').textContent = this.eventData.title;
        document.getElementById('display-event-date').textContent = this.eventData.date;
        document.getElementById('display-event-time').textContent = this.eventData.time;
        document.getElementById('display-event-location').textContent = this.eventData.location;
        document.getElementById('display-map-link').href = this.eventData.mapLink;

        if (!guest) {
            document.getElementById('display-guest-name').textContent = "ضيف عزيز";
            return;
        }

        document.getElementById('display-guest-name').textContent = guest.name;
        document.getElementById('guest-companions-count').value = guest.companions || 1;

        const decisionSection = document.getElementById('rsvp-decision-section');
        const declinedNotice = document.getElementById('declined-notice');
        const ticketSection = document.getElementById('entry-ticket-section');

        // Toggle Views based on Guest Status
        if (guest.status === 'accepted') {
            decisionSection.classList.add('hidden');
            declinedNotice.classList.add('hidden');
            ticketSection.classList.remove('hidden');

            this.renderTicketData(guest);
        } else if (guest.status === 'declined') {
            decisionSection.classList.add('hidden');
            declinedNotice.classList.remove('hidden');
            ticketSection.classList.add('hidden');
        } else {
            // Pending
            decisionSection.classList.remove('hidden');
            declinedNotice.classList.add('hidden');
            ticketSection.classList.add('hidden');
        }
    }

    // Render Ticket & QR Code
    renderTicketData(guest) {
        document.getElementById('ticket-guest-name').textContent = guest.name;
        document.getElementById('ticket-guest-phone').textContent = guest.phone;
        document.getElementById('ticket-unique-code').textContent = guest.ticketCode;
        document.getElementById('ticket-guests-count').textContent = guest.companions || 1;

        const qrContainer = document.getElementById('guest-qr-code-element');
        qrContainer.innerHTML = '';

        // Generate JSON data payload inside QR
        const qrPayload = JSON.stringify({
            code: guest.ticketCode,
            id: guest.id,
            name: guest.name,
            phone: guest.phone,
            count: guest.companions
        });

        // Generate QR using qrcode.js library
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: qrPayload,
                width: 160,
                height: 160,
                colorDark : "#0b132b",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    }

    // Handle RSVP Button Clicks
    handleGuestRSVP(newStatus) {
        const guest = this.getGuest(this.activeGuestId);
        if (!guest) return;

        guest.status = newStatus;
        if (newStatus === 'accepted') {
            const companionsCount = parseInt(document.getElementById('guest-companions-count').value, 10);
            guest.companions = companionsCount;

            // Trigger Fireworks celebration confetti!
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }

        this.saveState();
        this.renderGuestView();
        this.renderGuestsTable();
        this.populateGuestSimulatorDropdown();
    }

    // Process Check-in at Gate Scanner
    processGateCheckIn(codeOrPhone) {
        const cleanInput = codeOrPhone.trim();
        const guest = this.guests.find(g => 
            g.ticketCode.toLowerCase() === cleanInput.toLowerCase() ||
            g.phone.includes(cleanInput) ||
            cleanInput.includes(g.ticketCode)
        );

        const placeholder = document.getElementById('result-placeholder');
        const successBox = document.getElementById('result-success-state');
        const errorBox = document.getElementById('result-error-state');

        placeholder.classList.add('hidden');

        if (!guest) {
            // Not Found Error
            successBox.classList.add('hidden');
            errorBox.classList.remove('hidden');
            document.getElementById('res-error-badge').textContent = "خطأ: التذكرة غير مسجلة!";
            document.getElementById('res-err-guest-name').textContent = "لم يتم العثور على التذكرة";
            document.getElementById('res-err-message').textContent = `الرمز أو رقم الجوال (${cleanInput}) غير موجود في قائمة مدعوي المناسبة.`;
            this.playAudioAlert(false);
            return;
        }

        if (guest.checkedIn) {
            // Already checked in error!
            successBox.classList.add('hidden');
            errorBox.classList.remove('hidden');
            document.getElementById('res-error-badge').textContent = "تنبيه: تم استخدام التذكرة سابقاً!";
            document.getElementById('res-err-guest-name').textContent = guest.name;
            document.getElementById('res-err-message').textContent = `تم تسجيل دخول صاحب هذه التذكرة سابقاً الساعة (${guest.checkInTime}). يرجى منع إعادة الدخول!`;
            this.playAudioAlert(false);
        } else {
            // Success check-in!
            guest.checkedIn = true;
            guest.checkInTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            
            errorBox.classList.add('hidden');
            successBox.classList.remove('hidden');

            document.getElementById('res-guest-name').textContent = guest.name;
            document.getElementById('res-guest-phone').textContent = guest.phone;
            document.getElementById('res-guest-count').textContent = `${guest.companions} شخص`;
            document.getElementById('res-ticket-code').textContent = guest.ticketCode;
            document.getElementById('res-checkin-time').textContent = guest.checkInTime;

            // Log activity
            this.gateLogs.unshift({
                name: guest.name,
                code: guest.ticketCode,
                time: guest.checkInTime,
                count: guest.companions
            });

            this.saveState();
            this.renderGuestsTable();
            this.renderGateLogs();
            this.playAudioAlert(true);
        }
    }

    renderGateLogs() {
        const logContainer = document.getElementById('gate-log-list');
        const countSpan = document.getElementById('gate-log-count');
        
        countSpan.textContent = `${this.gateLogs.length} سجلات`;
        logContainer.innerHTML = '';

        if (this.gateLogs.length === 0) {
            logContainer.innerHTML = '<li class="empty-log">لم يتم تسجيل أي حضور حتى الآن</li>';
            return;
        }

        this.gateLogs.slice(0, 10).forEach(log => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${log.name}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">(${log.count} أشخاص)</span>
                </div>
                <div style="color:var(--gold-light);">
                    <i class="fa-solid fa-clock"></i> ${log.time}
                </div>
            `;
            logContainer.appendChild(li);
        });
    }

    // Toggle Camera Scanner
    toggleCameraScanner() {
        const cameraBox = document.getElementById('camera-box');
        const scannerVisual = document.getElementById('scanner-visual');

        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.stop().then(() => {
                scannerVisual.style.display = 'flex';
                document.getElementById('reader').style.display = 'none';
            });
            return;
        }

        if (typeof Html5Qrcode !== 'undefined') {
            document.getElementById('reader').style.display = 'block';
            scannerVisual.style.display = 'none';
            this.html5QrCode = new Html5Qrcode("reader");

            this.html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 200, height: 200 } },
                (decodedText) => {
                    // Try parsing JSON or raw text
                    let code = decodedText;
                    try {
                        const parsed = JSON.parse(decodedText);
                        if (parsed.code) code = parsed.code;
                    } catch(e) {}

                    this.processGateCheckIn(code);
                },
                (errorMessage) => {
                    // scanning...
                }
            ).catch(err => {
                alert('عذراً، لم نتمكن من الوصول لكاميرا الجهاز. يمكنك إدخال الكود يدويًا في الخانة المخصصة.');
                scannerVisual.style.display = 'flex';
                document.getElementById('reader').style.display = 'none';
            });
        }
    }

    // Sound effect generator via Web Audio API (No external sound files needed!)
    playAudioAlert(isSuccess) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (isSuccess) {
                // High double chime
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            } else {
                // Low buzz error
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch (e) {
            // Audio context not allowed without user gesture
        }
    }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EventApp();
});
