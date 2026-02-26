const db = require('./database');

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

async function seed() {
    console.log('กำลังล้างข้อมูลเก่า...');

    // Clear existing data
    await run("DELETE FROM schedules");
    await run("DELETE FROM requests");
    await run("DELETE FROM announcements");
    await run("DELETE FROM behavior_logs");
    await run("DELETE FROM grade_logs");
    await run("DELETE FROM enrollments");
    await run("DELETE FROM subjects");
    await run("DELETE FROM students");
    await run("DELETE FROM homeroom_teachers");
    await run("DELETE FROM classrooms");
    await run("DELETE FROM users");

    function getRealisticScore(mean = 70, stdDev = 12) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();

        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        const score = Math.round(z * stdDev + mean);

        return Math.max(0, Math.min(100, score));
    }

    // 1. Create Classrooms
    const classrooms = [
        'ม.1/1', 'ม.1/2', 'ม.1/3',
        'ม.2/1', 'ม.2/2', 'ม.2/3',
        'ม.3/1', 'ม.3/2', 'ม.3/3',
        'ม.4/1', 'ม.4/2',
        'ม.5/1', 'ม.5/2',
        'ม.6/1', 'ม.6/2'
    ];
    const classIds = [];
    const classroomLevels = {};

    // 2. Create Staff & Executive
    await run("INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, ?, ?, ?, ?)", ['staff', 'staff', 'staff', 'นางสาวใจดี ทะเบียนงาน', 'default-profile-women.png', 'female']);
    await run("INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, ?, ?, ?, ?)", ['manager', 'manager', 'executive', 'นายสมเกียรติ ยุติธรรม (ผู้อำนวยการ)', 'default-profile-men.png', 'male']);
    console.log('สร้างข้อมูลเจ้าหน้าที่และผู้บริหารสำเร็จ');

    // 3. Create Teachers
    const teachers = [
        // --- ข้อมูลเดิม ---
        { name: 'นายครูสมชาย ใจดี', username: 't_somchai' },
        { name: 'นางสาวครูสมศรี เรียนรู้', username: 't_somsri' },
        { name: 'นายครูสมศักดิ์ รักวิชา', username: 't_somsak' },
        { name: 'นางครูสมหญิง งามตา', username: 't_somying' },
        { name: 'นายครูสมพงษ์ มั่นคง', username: 't_sompong' },
        { name: 'นายครูปิติ ดีใจ', username: 't_piti' },
        { name: 'นางสาวครูมานะ ขยัน', username: 't_mana' },
        { name: 'นางครูชูใจ น่ารัก', username: 't_choojai' },
        { name: 'นายครูวีระ กล้าหาญ', username: 't_veera' },
        { name: 'นางสาวครูสุดา สวยงาม', username: 't_suda' },

        // --- ข้อมูลที่เพิ่มใหม่ (ใช้คำนำหน้าทางการ) ---
        // ครูผู้ชาย
        { name: 'นายกิตติ ชัยสิทธิ์', username: 't_kitti' },
        { name: 'นายณัฐวุฒิ รุ่งโรจน์', username: 't_nattawut' },
        { name: 'นายธนพล สุวรรณดี', username: 't_thanapol' },
        { name: 'นายพงศกร อุดมทรัพย์', username: 't_pongsakorn' },
        { name: 'นายประเสริฐ ศรีเมือง', username: 't_prasert' },
        { name: 'นายวิชัย ทองคำ', username: 't_wichai' },
        { name: 'นายสุชาติ บุญหนัก', username: 't_suchart' },
        { name: 'นายเอกชัย ชัยชนะ', username: 't_ekachai' },
        { name: 'นายกฤษดา แสงทอง', username: 't_kritsada' },
        { name: 'นายชานนท์ พิทักษ์', username: 't_chanon' },
        { name: 'นายทวีศักดิ์ มั่นคง', username: 't_taweesak' },
        { name: 'นายธนวัฒน์ สุขสวัสดิ์', username: 't_thanawat' },
        { name: 'นายบุญฤทธิ์ เจริญผล', username: 't_boonrit' },
        { name: 'นายปิยบุตร งามขำ', username: 't_piyabut' },
        { name: 'นายภานุพงศ์ ทองหล่อ', username: 't_panupong' },
        { name: 'นายวรวุฒิ ศิริกุล', username: 't_worawut' },
        { name: 'นายศุภชัย จันทร์หอม', username: 't_supachai' },
        { name: 'นายเกรียงไกร สิงห์โต', username: 't_kriangkrai' },
        { name: 'นายเฉลิมพล เงินมาก', username: 't_chalermpol' },
        { name: 'นายเตชินท์ สุริยะ', username: 't_techin' },

        // ครูผู้หญิง
        { name: 'นางสาวศิริพร พูลสวัสดิ์', username: 't_siriporn' },
        { name: 'นางกมลวรรณ โพธิ์ทอง', username: 't_kamonwan' },
        { name: 'นางสาววราภรณ์ วิลัย', username: 't_waraporn' },
        { name: 'นางกัญญาวีร์ เจริญทรัพย์', username: 't_kanyawee' },
        { name: 'นางสาวชลธิชา บุญจันทร์', username: 't_chonthicha' },
        { name: 'นางณัฐริกา แสงดาว', username: 't_nattarika' },
        { name: 'นางสาวทิพวรรณ มาลัย', username: 't_tippawan' },
        { name: 'นางธิดา แก้วตา', username: 't_thida' },
        { name: 'นางสาวนันทนา นิลวงศ์', username: 't_nantana' },
        { name: 'นางบุญญาพร รักษ์ไทย', username: 't_boonyaporn' },
        { name: 'นางสาวปาริชาติ สีดา', username: 't_parichat' },
        { name: 'นางพิมพา เพชรแท้', username: 't_pimpa' },
        { name: 'นางสาวมยุรี ชื่นชม', username: 't_mayuree' },
        { name: 'นางรจนา บัวบาน', username: 't_rotjana' },
        { name: 'นางสาวลลิตา รักสงบ', username: 't_lalita' },
        { name: 'นางวิไล มณีโชติ', username: 't_wilai' },
        { name: 'นางสาวศศิธร ทองใบ', username: 't_sasithorn' },
        { name: 'นางสุทธิดา รุ่งสว่าง', username: 't_sutthida' },
        { name: 'นางสาวอรทัย สวัสดี', username: 't_orathai' },
        { name: 'นางเบญจมาศ เทพพิทักษ์', username: 't_benjamas' }
    ];
    const teacherIds = [];
    for (const t of teachers) {
        const isFemale = t.name.startsWith('นาง');
        const gender = isFemale ? 'female' : 'male';
        const profilePic = isFemale ? 'default-profile-women.png' : 'default-profile-men.png';
        const res = await run("INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, ?, ?, ?, ?)", [t.username, 'password', 'teacher', t.name, profilePic, gender]);
        teacherIds.push(res.lastID);
    }
    console.log('สร้างข้อมูลครูสำเร็จ');

    const teacherClassCount = {};
    teacherIds.forEach(id => teacherClassCount[id] = 0);

    for (let i = 0; i < classrooms.length; i++) {
        // Create classroom
        const res = await run("INSERT INTO classrooms (name) VALUES (?)", [classrooms[i]]);
        const classId = res.lastID;
        classIds.push(classId);

        // Assign exactly 2 unique teachers to this classroom
        let assignedTeachers = [];
        let attempts = 0;
        while (assignedTeachers.length < 2 && attempts < 200) {
            const tId = teacherIds[Math.floor(Math.random() * teacherIds.length)];
            if (teacherClassCount[tId] < 3 && !assignedTeachers.includes(tId)) {
                await run("INSERT INTO homeroom_teachers (teacher_id, classroom_id) VALUES (?, ?)", [tId, classId]);
                teacherClassCount[tId]++;
                assignedTeachers.push(tId);
            }
            attempts++;
        }

        const cName = classrooms[i];
        const match = cName.match(/ม\.(\d+)/);
        classroomLevels[classId] = match ? parseInt(match[1]) : 1;
    }

    // 4. Create Subjects
    const subjectsData = [
        // --- มัธยมศึกษาตอนต้น (ม.1) ---
        // เทอม 1
        { code: 'ค21101', name: 'คณิตศาสตร์พื้นฐาน ม.1 เล่ม 1', credit: 1.5 },
        { code: 'ท21101', name: 'ภาษาไทย ม.1 เล่ม 1', credit: 1.5 },
        { code: 'อ21101', name: 'ภาษาอังกฤษพื้นฐาน ม.1 เล่ม 1', credit: 1.5 },
        { code: 'ว21101', name: 'วิทยาศาสตร์ ม.1 เล่ม 1', credit: 1.5 },
        { code: 'ส21101', name: 'สังคมศึกษา ม.1 เล่ม 1', credit: 1.5 },
        { code: 'พ21101', name: 'สุขศึกษาและพลศึกษา ม.1 เล่ม 1', credit: 1.0 },
        { code: 'ศ21101', name: 'ทัศนศิลป์ ม.1 เล่ม 1', credit: 0.5 },
        { code: 'ง21101', name: 'การงานอาชีพ ม.1 เล่ม 1', credit: 0.5 },
        // เทอม 2
        { code: 'ค21102', name: 'คณิตศาสตร์พื้นฐาน ม.1 เล่ม 2', credit: 1.5 },
        { code: 'ท21102', name: 'ภาษาไทย ม.1 เล่ม 2', credit: 1.5 },
        { code: 'อ21102', name: 'ภาษาอังกฤษพื้นฐาน ม.1 เล่ม 2', credit: 1.5 },
        { code: 'ว21102', name: 'วิทยาศาสตร์ ม.1 เล่ม 2', credit: 1.5 },
        { code: 'ส21102', name: 'สังคมศึกษา ม.1 เล่ม 2', credit: 1.5 },
        { code: 'พ21102', name: 'สุขศึกษาและพลศึกษา ม.1 เล่ม 2', credit: 1.0 },
        { code: 'ศ21102', name: 'ดุริยางคศิลป์ ม.1', credit: 0.5 },
        { code: 'ง21102', name: 'การออกแบบเทคโนโลยี ม.1', credit: 0.5 },

        // --- มัธยมศึกษาตอนต้น (ม.2) ---
        // เทอม 1
        { code: 'ค22101', name: 'คณิตศาสตร์พื้นฐาน ม.2 เล่ม 1', credit: 1.5 },
        { code: 'ท22101', name: 'ภาษาไทย ม.2 เล่ม 1', credit: 1.5 },
        { code: 'อ22101', name: 'ภาษาอังกฤษพื้นฐาน ม.2 เล่ม 1', credit: 1.5 },
        { code: 'ว22101', name: 'วิทยาศาสตร์ ม.2 เล่ม 1', credit: 1.5 },
        { code: 'ส22101', name: 'สังคมศึกษา ม.2 เล่ม 1', credit: 1.5 },
        { code: 'พ22101', name: 'สุขศึกษาและพลศึกษา ม.2 เล่ม 1', credit: 1.0 },
        { code: 'ศ22101', name: 'ทัศนศิลป์ ม.2 เล่ม 1', credit: 0.5 },
        { code: 'ง22101', name: 'การงานอาชีพ ม.2 เล่ม 1', credit: 0.5 },
        // เทอม 2
        { code: 'ค22102', name: 'คณิตศาสตร์พื้นฐาน ม.2 เล่ม 2', credit: 1.5 },
        { code: 'ท22102', name: 'ภาษาไทย ม.2 เล่ม 2', credit: 1.5 },
        { code: 'อ22102', name: 'ภาษาอังกฤษพื้นฐาน ม.2 เล่ม 2', credit: 1.5 },
        { code: 'ว22102', name: 'วิทยาศาสตร์ ม.2 เล่ม 2', credit: 1.5 },
        { code: 'ส22102', name: 'สังคมศึกษา ม.2 เล่ม 2', credit: 1.5 },
        { code: 'พ22102', name: 'สุขศึกษาและพลศึกษา ม.2 เล่ม 2', credit: 1.0 },
        { code: 'ศ22102', name: 'ดนตรีสากล ม.2', credit: 0.5 },
        { code: 'ง22102', name: 'วิทยาการคำนวณ ม.2', credit: 0.5 },

        // --- มัธยมศึกษาตอนต้น (ม.3) ---
        // เทอม 1
        { code: 'ค23101', name: 'คณิตศาสตร์พื้นฐาน ม.3 เล่ม 1', credit: 1.5 },
        { code: 'ท23101', name: 'ภาษาไทย ม.3 เล่ม 1', credit: 1.5 },
        { code: 'อ23101', name: 'ภาษาอังกฤษพื้นฐาน ม.3 เล่ม 1', credit: 1.5 },
        { code: 'ว23101', name: 'วิทยาศาสตร์ ม.3 เล่ม 1', credit: 1.5 },
        { code: 'ส23101', name: 'สังคมศึกษา ม.3 เล่ม 1', credit: 1.5 },
        { code: 'พ23101', name: 'สุขศึกษาและพลศึกษา ม.3 เล่ม 1', credit: 1.0 },
        { code: 'ศ23101', name: 'ทัศนศิลป์ ม.3 เล่ม 1', credit: 0.5 },
        { code: 'ง23101', name: 'การงานอาชีพ ม.3 เล่ม 1', credit: 0.5 },
        // เทอม 2
        { code: 'ค23102', name: 'คณิตศาสตร์พื้นฐาน ม.3 เล่ม 2', credit: 1.5 },
        { code: 'ท23102', name: 'ภาษาไทย ม.3 เล่ม 2', credit: 1.5 },
        { code: 'อ23102', name: 'ภาษาอังกฤษพื้นฐาน ม.3 เล่ม 2', credit: 1.5 },
        { code: 'ว23102', name: 'วิทยาศาสตร์ ม.3 เล่ม 2', credit: 1.5 },
        { code: 'ส23102', name: 'สังคมศึกษา ม.3 เล่ม 2', credit: 1.5 },
        { code: 'พ23102', name: 'สุขศึกษาและพลศึกษา ม.3 เล่ม 2', credit: 1.0 },
        { code: 'ศ23102', name: 'ดนตรีไทย ม.3', credit: 0.5 },
        { code: 'ง23102', name: 'เทคโนโลยีสารสนเทศ ม.3', credit: 0.5 },

        // --- มัธยมศึกษาตอนปลาย (ม.4) ---
        // เทอม 1
        { code: 'ค31101', name: 'คณิตศาสตร์พื้นฐาน ม.4 เทอม 1', credit: 1.5 },
        { code: 'ค31201', name: 'คณิตศาสตร์เพิ่มเติม ม.4 เทอม 1', credit: 2.0 },
        { code: 'อ31101', name: 'ภาษาอังกฤษพื้นฐาน ม.4 เทอม 1', credit: 1.5 },
        { code: 'ท31101', name: 'ภาษาไทย ม.4 เทอม 1', credit: 1.0 },
        { code: 'ว31201', name: 'ฟิสิกส์ ม.4 เทอม 1', credit: 2.0 },
        { code: 'ว31221', name: 'เคมี ม.4 เทอม 1', credit: 1.5 },
        { code: 'ว31241', name: 'ชีววิทยา ม.4 เทอม 1', credit: 1.5 },
        { code: 'ส31101', name: 'สังคมศึกษา ม.4 เทอม 1', credit: 1.0 },
        { code: 'พ31101', name: 'สุขศึกษา ม.4 เทอม 1', credit: 0.5 },
        { code: 'พ31103', name: 'พลศึกษา ม.4 เทอม 1', credit: 0.5 },
        // เทอม 2
        { code: 'ค31102', name: 'คณิตศาสตร์พื้นฐาน ม.4 เทอม 2', credit: 1.5 },
        { code: 'ค31202', name: 'คณิตศาสตร์เพิ่มเติม ม.4 เทอม 2', credit: 2.0 },
        { code: 'อ31102', name: 'ภาษาอังกฤษพื้นฐาน ม.4 เทอม 2', credit: 1.5 },
        { code: 'ท31102', name: 'ภาษาไทย ม.4 เทอม 2', credit: 1.0 },
        { code: 'ว31202', name: 'ฟิสิกส์ ม.4 เทอม 2', credit: 2.0 },
        { code: 'ว31222', name: 'เคมี ม.4 เทอม 2', credit: 1.5 },
        { code: 'ว31242', name: 'ชีววิทยา ม.4 เทอม 2', credit: 1.5 },
        { code: 'ส31102', name: 'สังคมศึกษา ม.4 เทอม 2', credit: 1.0 },
        { code: 'พ31102', name: 'สุขศึกษา ม.4 เทอม 2', credit: 0.5 },
        { code: 'พ31104', name: 'พลศึกษา ม.4 เทอม 2', credit: 0.5 },

        // --- มัธยมศึกษาตอนปลาย (ม.5) ---
        // เทอม 1
        { code: 'ค32101', name: 'คณิตศาสตร์พื้นฐาน ม.5 เทอม 1', credit: 1.5 },
        { code: 'ค32201', name: 'คณิตศาสตร์เพิ่มเติม ม.5 เทอม 1', credit: 2.0 },
        { code: 'ท32101', name: 'ภาษาไทย ม.5 เทอม 1', credit: 1.0 },
        { code: 'อ32101', name: 'ภาษาอังกฤษพื้นฐาน ม.5 เทอม 1', credit: 1.5 },
        { code: 'ว32201', name: 'ฟิสิกส์ ม.5 เทอม 1', credit: 2.0 },
        { code: 'ว32221', name: 'เคมี ม.5 เทอม 1', credit: 1.5 },
        { code: 'ว32241', name: 'ชีววิทยา ม.5 เทอม 1', credit: 1.5 },
        { code: 'ส32101', name: 'สังคมศึกษา ม.5 เทอม 1', credit: 1.0 },
        { code: 'พ32101', name: 'สุขศึกษา ม.5 เทอม 1', credit: 0.5 },
        { code: 'ศ32101', name: 'ศิลปะ ม.5 เทอม 1', credit: 0.5 },
        // เทอม 2
        { code: 'ค32102', name: 'คณิตศาสตร์พื้นฐาน ม.5 เทอม 2', credit: 1.5 },
        { code: 'ค32202', name: 'คณิตศาสตร์เพิ่มเติม ม.5 เทอม 2', credit: 2.0 },
        { code: 'ท32102', name: 'ภาษาไทย ม.5 เทอม 2', credit: 1.0 },
        { code: 'อ32102', name: 'ภาษาอังกฤษพื้นฐาน ม.5 เทอม 2', credit: 1.5 },
        { code: 'ว32202', name: 'ฟิสิกส์ ม.5 เทอม 2', credit: 2.0 },
        { code: 'ว32222', name: 'เคมี ม.5 เทอม 2', credit: 1.5 },
        { code: 'ว32242', name: 'ชีววิทยา ม.5 เทอม 2', credit: 1.5 },
        { code: 'ส32102', name: 'สังคมศึกษา ม.5 เทอม 2', credit: 1.0 },
        { code: 'พ32102', name: 'สุขศึกษา ม.5 เทอม 2', credit: 0.5 },
        { code: 'ศ32102', name: 'ทัศนศิลป์ ม.5 เทอม 2', credit: 0.5 },

        // --- มัธยมศึกษาตอนปลาย (ม.6) ---
        // เทอม 1
        { code: 'ค33101', name: 'คณิตศาสตร์พื้นฐาน ม.6 เทอม 1', credit: 1.5 },
        { code: 'ค33201', name: 'คณิตศาสตร์เพิ่มเติม ม.6 เทอม 1', credit: 2.0 },
        { code: 'ท33101', name: 'ภาษาไทย ม.6 เทอม 1', credit: 1.0 },
        { code: 'อ33101', name: 'ภาษาอังกฤษพื้นฐาน ม.6 เทอม 1', credit: 1.5 },
        { code: 'ว33201', name: 'ฟิสิกส์ ม.6 เทอม 1', credit: 2.0 },
        { code: 'ว33221', name: 'เคมี ม.6 เทอม 1', credit: 1.5 },
        { code: 'ว33241', name: 'ชีววิทยา ม.6 เทอม 1', credit: 1.5 },
        { code: 'ส33101', name: 'สังคมศึกษา ม.6 เทอม 1', credit: 1.0 },
        { code: 'ง33101', name: 'การงานอาชีพ ม.6 เทอม 1', credit: 0.5 },
        { code: 'ว33261', name: 'โลก ดาราศาสตร์ และอวกาศ ม.6 เทอม 1', credit: 1.0 },
        // เทอม 2
        { code: 'ค33102', name: 'คณิตศาสตร์พื้นฐาน ม.6 เทอม 2', credit: 1.5 },
        { code: 'ค33202', name: 'คณิตศาสตร์เพิ่มเติม ม.6 เทอม 2', credit: 2.0 },
        { code: 'ท33102', name: 'ภาษาไทย ม.6 เทอม 2', credit: 1.0 },
        { code: 'อ33102', name: 'ภาษาอังกฤษพื้นฐาน ม.6 เทอม 2', credit: 1.5 },
        { code: 'ว33202', name: 'ฟิสิกส์ ม.6 เทอม 2', credit: 2.0 },
        { code: 'ว33222', name: 'เคมี ม.6 เทอม 2', credit: 1.5 },
        { code: 'ว33242', name: 'ชีววิทยา ม.6 เทอม 2', credit: 1.5 },
        { code: 'ส33102', name: 'สังคมศึกษา ม.6 เทอม 2', credit: 1.0 },
        { code: 'ง33102', name: 'วิทยาการคำนวณ ม.6 เทอม 2', credit: 0.5 },
        { code: 'ว33262', name: 'โลก ดาราศาสตร์ และอวกาศ ม.6 เทอม 2', credit: 1.0 }
    ];

    const subjectsByLevel = {
        1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };
    const subjectIds = [];
    for (let i = 0; i < subjectsData.length; i++) {
        const s = subjectsData[i];
        const teacherId = teacherIds[i % teacherIds.length];
        const res = await run("INSERT INTO subjects (code, name, credit, teacher_id) VALUES (?, ?, ?, ?)",
            [s.code, s.name, s.credit, teacherId]);
        const subjId = res.lastID;
        subjectIds.push(subjId);

        const levelCode = s.code.substring(1, 3);
        let level = 1;
        if (levelCode === '21') level = 1;
        else if (levelCode === '22') level = 2;
        else if (levelCode === '23') level = 3;
        else if (levelCode === '31') level = 4;
        else if (levelCode === '32') level = 5;
        else if (levelCode === '33') level = 6;

        subjectsByLevel[level].push(subjId);
    }
    console.log('สร้างข้อมูลรายวิชาสำเร็จ');

    const classroomCurriculum = {};
    for (const classId of classIds) {
        const level = classroomLevels[classId];
        const levelSubjects = subjectsByLevel[level] || [];

        // แยกวิชาเทอม 1 (เลขคี่) และเทอม 2 (เลขคู่)
        const term1Subjects = levelSubjects.filter(subjId => {
            const subject = subjectsData.find((_, index) => subjectIds[index] === subjId);
            return subject && (parseInt(subject.code.slice(-1)) % 2 !== 0);
        });
        const term2Subjects = levelSubjects.filter(subjId => {
            const subject = subjectsData.find((_, index) => subjectIds[index] === subjId);
            return subject && (parseInt(subject.code.slice(-1)) % 2 === 0);
        });

        // ดึง 5-6 วิชาต่อเทอม
        const numTerm1 = Math.min(term1Subjects.length, 5 + Math.floor(Math.random() * 2));
        const numTerm2 = Math.min(term2Subjects.length, 5 + Math.floor(Math.random() * 2));

        const shuffledTerm1 = [...term1Subjects].sort(() => 0.5 - Math.random()).slice(0, numTerm1);
        const shuffledTerm2 = [...term2Subjects].sort(() => 0.5 - Math.random()).slice(0, numTerm2);

        // รวมวิชาของทั้งสองเทอม
        classroomCurriculum[classId] = [...shuffledTerm1, ...shuffledTerm2];
    }

    // 5. Create Students
    const firstNames = [
        'สมชาย', 'สมหญิง', 'สุดา', 'มานี', 'ปิติ', 'ชูใจ', 'วีระ', 'สมศักดิ์',
        'พรเทพ', 'ณัฐวุฒิ', 'ศิริพร', 'กมลวรรณ', 'อภิชาติ', 'วราภรณ์', 'ชัยยุทธ',
        'ณัฐพล', 'ธนพล', 'พงศกร', 'นพดล', 'ประเสริฐ', 'วิชัย', 'สุชาติ', 'เอกชัย',
        'อนุชา', 'กฤษดา', 'จิรายุ', 'ชานนท์', 'ทวีศักดิ์', 'ธนวัฒน์', 'นฤมล',
        'บุญฤทธิ์', 'ปิยบุตร', 'พชร', 'ภานุพงศ์', 'มนตรี', 'รุ่งโรจน์', 'วรวุฒิ',
        'ศุภชัย', 'สมบูรณ์', 'อดิศักดิ์', 'อาทิตย์', 'เกรียงไกร', 'เฉลิมพล', 'เตชินท์',
        'เปรม', 'เอกพล', 'กัญญาวีร์', 'ชลธิชา', 'ณัฐริกา', 'ดวงใจ', 'ทิพวรรณ',
        'ธิดา', 'นันทนา', 'บุญญาพร', 'ประภาสิริ', 'ปาริชาติ', 'พิมพา', 'ภคพร',
        'มยุรี', 'รจนา', 'ลลิตา', 'วิไล', 'ศศิธร', 'สุทธิดา', 'อรทัย', 'อารียา',
        'เกษรา', 'เจนจิรา', 'เบญจมาศ', 'สุรศักดิ์', 'ธีรยุทธ', 'กิตติพงศ์'
    ];

    const lastNames = [
        'ใจดี', 'รักเรียน', 'มั่นคง', 'มีสุข', 'เดชะ', 'กล้าหาญ', 'ขยัน', 'อดทน',
        'เจริญ', 'สุวรรณ', 'ทองดี', 'วิเศษ', 'สิงห์โต', 'พิทักษ์', 'สมบูรณ์',
        'รุ่งเรือง', 'ประเสริฐ', 'วิลัย', 'สวัสดี', 'ชัยชนะ', 'งามขำ', 'บุญจันทร์',
        'แสงทอง', 'ทองใบ', 'ชื่นชม', 'โพธิ์ทอง', 'เพชรแท้', 'ใจสว่าง', 'รุ่งสว่าง',
        'พูนทรัพย์', 'จันทร์หอม', 'สุขเกษม', 'ทองคำ', 'เจริญผล', 'รักสงบ',
        'ชัยสิทธิ์', 'บุญส่ง', 'แสงดาว', 'มณีโชติ', 'พงษ์สุวรรณ', 'ศรีสุข', 'นิลวงศ์',
        'สุริยะ', 'จันทร์เพ็ญ', 'ทองหล่อ', 'เงินมาก', 'สุขสวัสดิ์', 'เจริญทรัพย์',
        'อุดมทรัพย์', 'บัวบาน', 'มาลัย', 'สีดา', 'พูลสวัสดิ์', 'สิงห์คำ', 'รักษ์ไทย',
        'บุญหนัก', 'ศรีเมือง', 'แก้วตา', 'ศิริกุล', 'เทพพิทักษ์', 'ดำรงค์'
    ];

    for (let i = 1; i <= 250; i++) {
        const classId = classIds[i % classIds.length];
        const studentNum = i.toString().padStart(5, '0');
        const studentCode = `67${studentNum}`; // 67XXXXX
        const username = `s${studentCode}`; // s67XXXXX
        const password = username; // password = username

        const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
        const prefix = (i % 2 === 0) ? 'นางสาว' : 'นาย';
        const fullName = `${prefix}${fname} ${lname}`;

        const isFemale = prefix === 'นางสาว';
        const gender = isFemale ? 'female' : 'male';
        const profilePic = isFemale ? 'default-profile-women.png' : 'default-profile-men.png';

        // User
        const userRes = await run("INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, ?, ?, ?, ?)", [username, password, 'student', fullName, profilePic, gender]);

        // Student Record
        const stdRes = await run("INSERT INTO students (user_id, classroom_id, student_code) VALUES (?, ?, ?)", [userRes.lastID, classId, studentCode]);
        const studentId = stdRes.lastID;

        const enrolledSubjects = classroomCurriculum[classId];

        const addGradeForSubject = async (subjId) => {
            const total = getRealisticScore();
            const midRatio = 0.4 + (Math.random() * 0.2); // กลางภาคจะมีสัดส่วนประมาณ 40%-60% ของคะแนนรวม
            let mid = Math.round(total * midRatio);
            if (mid > 50) mid = 50;

            let fin = total - mid;
            if (fin > 50) {
                fin = 50;
                mid = total - fin;
            }

            let grade = 'F';
            if (total >= 80) grade = 'A';
            else if (total >= 75) grade = 'B+';
            else if (total >= 70) grade = 'B';
            else if (total >= 65) grade = 'C+';
            else if (total >= 60) grade = 'C';
            else if (total >= 55) grade = 'D+';
            else if (total >= 50) grade = 'D';
            else grade = 'F';

            await run("INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char, academic_year, semester, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [studentId, subjId, mid, fin, total, grade, '2567', '1', 1]);
        };

        const studentLevel = classroomLevels[classId];

        // Grades for previous levels
        for (let prevLvl = 1; prevLvl < studentLevel; prevLvl++) {
            const prevSubjects = subjectsByLevel[prevLvl] || [];
            if (prevSubjects.length === 0) continue;

            // แยกวิชาเทอม 1 (เลขคี่) และเทอม 2 (เลขคู่)
            const term1Subjects = prevSubjects.filter(subjId => {
                const subject = subjectsData.find((_, index) => subjectIds[index] === subjId);
                return subject && (parseInt(subject.code.slice(-1)) % 2 !== 0);
            });
            const term2Subjects = prevSubjects.filter(subjId => {
                const subject = subjectsData.find((_, index) => subjectIds[index] === subjId);
                return subject && (parseInt(subject.code.slice(-1)) % 2 === 0);
            });

            // ดึงวิชา 5-6 วิชาต่อเทอมเหมือนเทอมปัจจุบัน
            const numTerm1 = Math.min(term1Subjects.length, 5 + Math.floor(Math.random() * 2));
            const numTerm2 = Math.min(term2Subjects.length, 5 + Math.floor(Math.random() * 2));

            const shuffledTerm1 = [...term1Subjects].sort(() => 0.5 - Math.random()).slice(0, numTerm1);
            const shuffledTerm2 = [...term2Subjects].sort(() => 0.5 - Math.random()).slice(0, numTerm2);

            const allPrevSubjects = [...shuffledTerm1, ...shuffledTerm2];

            for (const subjId of allPrevSubjects) {
                await addGradeForSubject(subjId);
            }
        }

        // Grades for current level
        for (const subjId of Array.from(enrolledSubjects)) {
            await addGradeForSubject(subjId);
        }
    }
    console.log('สร้างข้อมูลนักเรียนและการลงทะเบียนสำเร็จ');

    // 6. Create Schedules
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = ['08:30-09:20', '09:20-10:10', '10:20-11:10', '11:10-12:00', '13:00-13:50', '13:50-14:40', '14:50-15:40'];

    for (const classId of classIds) {
        // ใช้เฉพาะรายวิชาที่กำหนดไว้สำหรับห้องเรียนนี้เท่านั้นในการจัดตารางสอน
        const subjectsForThisClass = classroomCurriculum[classId];

        for (const day of days) {
            let numPeriods = 4 + Math.floor(Math.random() * 3);
            const selectedTimes = [...times].sort(() => 0.5 - Math.random()).slice(0, numPeriods);

            for (const time of selectedTimes) {
                const subjId = subjectsForThisClass[Math.floor(Math.random() * subjectsForThisClass.length)];
                await run("INSERT INTO schedules (classroom_id, subject_id, day, time_slot) VALUES (?, ?, ?, ?)",
                    [classId, subjId, day, time]);
            }
        }
    }
    console.log('สร้างตารางเรียนสำเร็จ');

    db.close();
    console.log('เสร็จสิ้นการสร้างข้อมูลเริ่มต้น');
}

seed();
