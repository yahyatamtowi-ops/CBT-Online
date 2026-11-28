import type { ExamPackage, Question, StudentRecord, TeacherAccount } from "../types/cbt";

export interface DefaultSchoolSnapshot {
  classes: string[];
  teachers: TeacherAccount[];
  students: StudentRecord[];
  packages: ExamPackage[];
  questions: Question[];
}

export const DEFAULT_SCHOOL_SNAPSHOT: DefaultSchoolSnapshot = {
  "classes": [
    "X A",
    "X B",
    "X C",
    "X D",
    "X E",
    "XI A",
    "XI B",
    "XI C",
    "XI D",
    "XI E",
    "XII A",
    "XII B",
    "XII C",
    "XII D",
    "XII E"
  ],
  "teachers": [
    {
      "id": "teacher-1795880402472",
      "username": "tamtowiyahya",
      "nip": "199705182023211003",
      "name": "Tamtowi Yahya, S.Pd.",
      "password": "Yahya199705!",
      "subjects": [
        "Bahasa Indonesia",
        "Bahasa Indonesia Tingkat Lanjut"
      ],
      "classes": [
        "XI D",
        "XI E",
        "XII A",
        "XII B",
        "XII C",
        "XII D",
        "XII E"
      ],
      "active": true
    },
    {
      "id": "teacher-1795880449689",
      "username": "riskapuspita",
      "nip": "198603042023212003",
      "name": "Riska Puspita, S.Pd.",
      "password": "Riskapuspita123!",
      "subjects": [
        "Bahasa Inggris"
      ],
      "classes": [
        "X A",
        "X B",
        "X C",
        "X D",
        "X E",
        "XI A",
        "XI B",
        "XI C",
        "XI D",
        "XI E"
      ],
      "active": true
    }
  ],
  "students": [
    {
      "nisn": "0114459934",
      "name": "AINI ZAHYRA SALSABILA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-0"
    },
    {
      "nisn": "0116520662",
      "name": "AMANAD KRISDIANTO GULO",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-1"
    },
    {
      "nisn": "0107883243",
      "name": "AMIRA ZALFAHIRA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-2"
    },
    {
      "nisn": "0101718480",
      "name": "AQILAH HENDRI KAPUTRI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-3"
    },
    {
      "nisn": "0105113917",
      "name": "BELLA SYAHFIRA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-4"
    },
    {
      "nisn": "0114797833",
      "name": "BILQIS NURWANA ZAHRA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-5"
    },
    {
      "nisn": "0106909759",
      "name": "DINA MARDIANI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-6"
    },
    {
      "nisn": "0113842899",
      "name": "DOSMAWATI BR. HUTABARAT",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-7"
    },
    {
      "nisn": "0107987033",
      "name": "ELISA KAMELIA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-8"
    },
    {
      "nisn": "0107282520",
      "name": "HAFIDA ADHA LAILA BR DAMANIK",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-9"
    },
    {
      "nisn": "0116804427",
      "name": "HUMAIRA SALSABILA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-10"
    },
    {
      "nisn": "0099525606",
      "name": "INESA AULIYA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-11"
    },
    {
      "nisn": "0095845100",
      "name": "JERNIUS SIRINGO-RINGO",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-12"
    },
    {
      "nisn": "0112980038",
      "name": "KHALISHA TRI RAMADHANI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-13"
    },
    {
      "nisn": "0118464207",
      "name": "LATHIFA HUMAIROH",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-14"
    },
    {
      "nisn": "0119438765",
      "name": "LATIFA KHAYLANI SULFA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-15"
    },
    {
      "nisn": "0109457849",
      "name": "LISA WIDIA BUULELE",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-16"
    },
    {
      "nisn": "0107540057",
      "name": "M. FARHAN",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-17"
    },
    {
      "nisn": "0112597621",
      "name": "MIKHAEL ROY NAINGGOLAN",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-18"
    },
    {
      "nisn": "0118144642",
      "name": "MOSES SAHABAT IMMANUEL NAIBAHO",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-19"
    },
    {
      "nisn": "0106693440",
      "name": "MUHAMMAD FAJRI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-20"
    },
    {
      "nisn": "0111366227",
      "name": "MUHAMMAD RESTU",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-21"
    },
    {
      "nisn": "0112162337",
      "name": "NIKY RAHMA DANI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-22"
    },
    {
      "nisn": "0107892191",
      "name": "NURUL FALAH HUSNA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-23"
    },
    {
      "nisn": "0118874659",
      "name": "PANJI ADIE PUTRA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-24"
    },
    {
      "nisn": "0109020971",
      "name": "RAFA IRAWAN",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-25"
    },
    {
      "nisn": "0108015955",
      "name": "RASMI NADIN WINATA BR SIDABUTAR",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-26"
    },
    {
      "nisn": "0097666022",
      "name": "REYFAN HAMBALI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-27"
    },
    {
      "nisn": "0113605598",
      "name": "RINDHIANI INKA SARI",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-28"
    },
    {
      "nisn": "0096684796",
      "name": "Taskia Fitri Wulandari",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-29"
    },
    {
      "nisn": "0111624262",
      "name": "TASYA DEWI PUTRI LUBIS",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-30"
    },
    {
      "nisn": "0119418879",
      "name": "TEO MARLFIANO",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-31"
    },
    {
      "nisn": "0112040332",
      "name": "ULFA ZAHRA",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-32"
    },
    {
      "nisn": "0107394044",
      "name": "ZAHIRA HANUM",
      "className": "X A",
      "active": true,
      "id": "stu-csv-1795880353567-33"
    },
    {
      "nisn": "0096581265",
      "name": "ADLY PRASASTIA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-34"
    },
    {
      "nisn": "0097175736",
      "name": "AGUS PREDIANTO ZALUKHU",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-35"
    },
    {
      "nisn": "0109450014",
      "name": "AJI SEKA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-36"
    },
    {
      "nisn": "0119560614",
      "name": "AMIRA SAFITRI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-37"
    },
    {
      "nisn": "0115034609",
      "name": "ANDINI MAHARANI DAMANIK",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-38"
    },
    {
      "nisn": "0119253288",
      "name": "AULIYA KASIH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-39"
    },
    {
      "nisn": "0105326703",
      "name": "CRISTIN RAHMATYA SIRUMAPEA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-40"
    },
    {
      "nisn": "0112183124",
      "name": "DANTE WARUHU",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-41"
    },
    {
      "nisn": "0114678273",
      "name": "DELVIA MENDROFA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-42"
    },
    {
      "nisn": "0103579165",
      "name": "ELSA PUTRI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-43"
    },
    {
      "nisn": "0109249964",
      "name": "FATHIR AL HABSY",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-44"
    },
    {
      "nisn": "0099899013",
      "name": "FIKI ARDINATA SARAGIH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-45"
    },
    {
      "nisn": "0111063328",
      "name": "FILZAH ASSAFWAH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-46"
    },
    {
      "nisn": "0117359683",
      "name": "FUJI NOVHA SARI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-47"
    },
    {
      "nisn": "0113924476",
      "name": "GOOD MAN GABRIEL MANURUNG",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-48"
    },
    {
      "nisn": "0111081343",
      "name": "JULIA DYAH PITALOKA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-49"
    },
    {
      "nisn": "0112545986",
      "name": "KARTIKA RIANI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-50"
    },
    {
      "nisn": "0102841033",
      "name": "KEZIA OTAVIA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-51"
    },
    {
      "nisn": "0116003521",
      "name": "LESMANA WAHYU PAMUNGKAS",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-52"
    },
    {
      "nisn": "0113898868",
      "name": "M. RIZKY AL FAHRI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-53"
    },
    {
      "nisn": "0109684099",
      "name": "MALTA PHYLEN SIMATUPANG",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-54"
    },
    {
      "nisn": "0112796929",
      "name": "MIRACLE SIMAMORA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-55"
    },
    {
      "nisn": "0117791163",
      "name": "NAJWA DEA HAFIZAH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-56"
    },
    {
      "nisn": "0119002795",
      "name": "NAYSILA TSABITA MARSHA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-57"
    },
    {
      "nisn": "0115644010",
      "name": "RAFA ARDANY",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-58"
    },
    {
      "nisn": "0105620782",
      "name": "RISKIA AMANDA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-59"
    },
    {
      "nisn": "0105893922",
      "name": "SAIFUL IBRAHIM NUGRAHA SIREGAR",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-60"
    },
    {
      "nisn": "0103711929",
      "name": "SALSABILA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-61"
    },
    {
      "nisn": "0107154069",
      "name": "SAMIRA ANUGRAH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-62"
    },
    {
      "nisn": "0115820271",
      "name": "SAZLIN AIRINA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-63"
    },
    {
      "nisn": "0115450528",
      "name": "Sevania Br Sibarani",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-64"
    },
    {
      "nisn": "0116749425",
      "name": "TANIA FITRI RAHMADANI",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-65"
    },
    {
      "nisn": "0118503488",
      "name": "VIVI ASHIFAH",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-66"
    },
    {
      "nisn": "0111711742",
      "name": "YOSI AFRILIA SHENA",
      "className": "X B",
      "active": true,
      "id": "stu-csv-1795880353567-67"
    },
    {
      "nisn": "0107911413",
      "name": "AFIFA FITIYA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-68"
    },
    {
      "nisn": "0113566960",
      "name": "ANISA NURHASANAH",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-69"
    },
    {
      "nisn": "0101042191",
      "name": "ANJALIA KIRANA PUTRI",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-70"
    },
    {
      "nisn": "0109897546",
      "name": "AZKA MUTTAWAKIL",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-71"
    },
    {
      "nisn": "0118111074",
      "name": "AZLINA KASIH",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-72"
    },
    {
      "nisn": "0108322555",
      "name": "BAYU DWI ANDHIKA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-73"
    },
    {
      "nisn": "0117684879",
      "name": "BUNGA GABRIEL BR GULTOM",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-74"
    },
    {
      "nisn": "0106323497",
      "name": "BUNGA LASMARITO",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-75"
    },
    {
      "nisn": "0111472598",
      "name": "CINDI AULIA BR LUBIS",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-76"
    },
    {
      "nisn": "0105884711",
      "name": "CRISNA YUVAL ADWITYA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-77"
    },
    {
      "nisn": "0112446365",
      "name": "DAIROBY ALGI FAHRY",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-78"
    },
    {
      "nisn": "0106054730",
      "name": "DARTO WARUHU",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-79"
    },
    {
      "nisn": "0113921158",
      "name": "Elsanti Br Hasugian",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-80"
    },
    {
      "nisn": "0101772612",
      "name": "FATIA DARMA AYU",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-81"
    },
    {
      "nisn": "0108627841",
      "name": "HAFIZA HUMAIROH",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-82"
    },
    {
      "nisn": "3117257342",
      "name": "KEYZIA NABILLAH",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-83"
    },
    {
      "nisn": "0119384157",
      "name": "Laura Br Sigalingging",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-84"
    },
    {
      "nisn": "0106908559",
      "name": "M. ALFAYED",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-85"
    },
    {
      "nisn": "0116437214",
      "name": "M. PANDI SILITONGA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-86"
    },
    {
      "nisn": "0116713692",
      "name": "MALKAN ADLAN",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-87"
    },
    {
      "nisn": "0117582115",
      "name": "MIZI JULIANTO PRATAMA NASUTION",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-88"
    },
    {
      "nisn": "0102937392",
      "name": "NABILA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-89"
    },
    {
      "nisn": "0117148282",
      "name": "NABILA AMELIA SAPUTRI",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-90"
    },
    {
      "nisn": "0111200291",
      "name": "NAJWA YULIARANI",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-91"
    },
    {
      "nisn": "0118449169",
      "name": "NAJWA ZAHIRA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-92"
    },
    {
      "nisn": "0118515366",
      "name": "PRADA PRATAMA SEMBIRING",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-93"
    },
    {
      "nisn": "0116030415",
      "name": "RAISYA AURA MEDITA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-94"
    },
    {
      "nisn": "0112659669",
      "name": "RATIH HANDAYANI BATU BARA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-95"
    },
    {
      "nisn": "0112829916",
      "name": "REYNAL HANFIANO",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-96"
    },
    {
      "nisn": "0119514890",
      "name": "RIZKIKA NATASYA PUTRI",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-97"
    },
    {
      "nisn": "0115110788",
      "name": "SALSABILA MUNAWARAH ADEFA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-98"
    },
    {
      "nisn": "0111981531",
      "name": "SEYLA WINANDA",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-99"
    },
    {
      "nisn": "0111109838",
      "name": "SYAFIRA ANGGRAINI",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-100"
    },
    {
      "nisn": "0109470711",
      "name": "SYAHRONITA AULIA PUTRI SIREGAR",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-101"
    },
    {
      "nisn": "0097702808",
      "name": "UCOK ZALUKHU",
      "className": "X C",
      "active": true,
      "id": "stu-csv-1795880353567-102"
    },
    {
      "nisn": "0104964613",
      "name": "ADELIA SALSADILA BR LUBIS",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-103"
    },
    {
      "nisn": "0117202330",
      "name": "AHMAD ABDILLAH",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-104"
    },
    {
      "nisn": "0116687089",
      "name": "AISYAH SIREGAR",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-105"
    },
    {
      "nisn": "0115440648",
      "name": "ALFARO HASIAN PAKPAHAN",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-106"
    },
    {
      "nisn": "0118531105",
      "name": "ALFAZAR IMRON SYAHRIDHO",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-107"
    },
    {
      "nisn": "0119560338",
      "name": "AYU MARISA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-108"
    },
    {
      "nisn": "0109885476",
      "name": "AZZURA NALLATISYA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-109"
    },
    {
      "nisn": "0117028012",
      "name": "CARINE JEAN HUTABARAT",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-110"
    },
    {
      "nisn": "0114060507",
      "name": "CIKA AGUSTIN RAMADHANI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-111"
    },
    {
      "nisn": "0102576660",
      "name": "CITRA MALIKKA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-112"
    },
    {
      "nisn": "0106067805",
      "name": "DAVID MARCELINO SITOMPUL",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-113"
    },
    {
      "nisn": "0119705196",
      "name": "ELLOKO BEMAR HUTAGALUNG",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-114"
    },
    {
      "nisn": "0114355192",
      "name": "FARADIS TIFANI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-115"
    },
    {
      "nisn": "0115195095",
      "name": "FATHIR ROHIM",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-116"
    },
    {
      "nisn": "0114522523",
      "name": "HAFIFA KHAIRANI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-117"
    },
    {
      "nisn": "0101555672",
      "name": "HARVINA PRATIWI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-118"
    },
    {
      "nisn": "0119493842",
      "name": "HAYATUL LAILI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-119"
    },
    {
      "nisn": "0103688236",
      "name": "JEASTIN WILLY YERONIA SIHOTANG",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-120"
    },
    {
      "nisn": "0115871220",
      "name": "JIHAN FEBRIANI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-121"
    },
    {
      "nisn": "0115340241",
      "name": "LUTHFI FAHRULLY",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-122"
    },
    {
      "nisn": "0111803943",
      "name": "MANUELLA CHRISTY PASARIBU",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-123"
    },
    {
      "nisn": "0117629564",
      "name": "NADIRA LATIVA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-124"
    },
    {
      "nisn": "0103235326",
      "name": "NAYLATUS SA'ADA PUTRI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-125"
    },
    {
      "nisn": "0111604317",
      "name": "NEISYA SYAHFIRA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-126"
    },
    {
      "nisn": "0116377865",
      "name": "Nurhayati",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-127"
    },
    {
      "nisn": "0112173676",
      "name": "PRISILLIA ADINDA RADISTY",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-128"
    },
    {
      "nisn": "0116460634",
      "name": "PUTRI MAGDALENA  BR. LBN BATU",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-129"
    },
    {
      "nisn": "0116366012",
      "name": "RAFI PADELINO",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-130"
    },
    {
      "nisn": "0097084425",
      "name": "RIA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-131"
    },
    {
      "nisn": "0111115251",
      "name": "Risky Aditya",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-132"
    },
    {
      "nisn": "0107575067",
      "name": "SULISTIYO NINGRUM",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-133"
    },
    {
      "nisn": "0111971050",
      "name": "TAQIYA FATRUN NADA",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-134"
    },
    {
      "nisn": "0104161179",
      "name": "TEGUH RAMADANI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-135"
    },
    {
      "nisn": "0106434250",
      "name": "ZAHRA ANGGRAINI",
      "className": "X D",
      "active": true,
      "id": "stu-csv-1795880353567-136"
    },
    {
      "nisn": "0111093517",
      "name": "ABBY MUHAMMAD FADILLAH",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-137"
    },
    {
      "nisn": "0113857376",
      "name": "ALIF DAFFA MAHERA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-138"
    },
    {
      "nisn": "0104410335",
      "name": "AULYA FITRI SIMATUPANG",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-139"
    },
    {
      "nisn": "0117864204",
      "name": "BALQIS HAYATUL HUSNA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-140"
    },
    {
      "nisn": "0115923284",
      "name": "DARSIH GADIS",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-141"
    },
    {
      "nisn": "0113810224",
      "name": "Dera Afriana",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-142"
    },
    {
      "nisn": "0111492754",
      "name": "ELDIPA RIFAEL SITOMPUL",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-143"
    },
    {
      "nisn": "0117739443",
      "name": "FAHRI MAULANA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-144"
    },
    {
      "nisn": "0119592321",
      "name": "FAUZIAH AZIMA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-145"
    },
    {
      "nisn": "0108042706",
      "name": "IMMANUELSA PAKPAHAN",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-146"
    },
    {
      "nisn": "0102509451",
      "name": "JULIUS CAESAR",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-147"
    },
    {
      "nisn": "0113864419",
      "name": "KHAIRUNISA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-148"
    },
    {
      "nisn": "0095572911",
      "name": "MARFEL WIRA KUSUMAN ZEBUA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-149"
    },
    {
      "nisn": "0108916733",
      "name": "MERYHANDA OCTAVIA STEVAREN SIAHAAN",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-150"
    },
    {
      "nisn": "0103976356",
      "name": "MUHAMMAD AL FURQON",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-151"
    },
    {
      "nisn": "0111770769",
      "name": "MUTIARA RAHMA NUR ISLAMI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-152"
    },
    {
      "nisn": "0116568836",
      "name": "NAJWA PITA SAHPUTRI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-153"
    },
    {
      "nisn": "0117286683",
      "name": "NAYLA NISFATUL KHOIROH",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-154"
    },
    {
      "nisn": "0117611908",
      "name": "NUR HAFIZAH",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-155"
    },
    {
      "nisn": "0115883435",
      "name": "NURAINI SARI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-156"
    },
    {
      "nisn": "0104543969",
      "name": "OKTAFIA BR SIHOMBING",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-157"
    },
    {
      "nisn": "0107026656",
      "name": "PUTRA SINAGA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-158"
    },
    {
      "nisn": "0117154440",
      "name": "RANDI AKBAR",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-159"
    },
    {
      "nisn": "0109112404",
      "name": "RAYYAN HILMANSYAH",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-160"
    },
    {
      "nisn": "0119285412",
      "name": "REVI ZAHARA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-161"
    },
    {
      "nisn": "0119357731",
      "name": "RIAHNITA SAMOSIR",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-162"
    },
    {
      "nisn": "0117295230",
      "name": "SALWAA IZZA NIRWANA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-163"
    },
    {
      "nisn": "0115925038",
      "name": "SALWATUL AYSI PUTRI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-164"
    },
    {
      "nisn": "0105302002",
      "name": "SHADIQ ARKAN",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-165"
    },
    {
      "nisn": "0113999393",
      "name": "TANTRI KELANA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-166"
    },
    {
      "nisn": "0119562015",
      "name": "Thresya Br Hutagalung",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-167"
    },
    {
      "nisn": "0119062793",
      "name": "TRI AINI PRIYANTI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-168"
    },
    {
      "nisn": "0117970170",
      "name": "VIA FINATA",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-169"
    },
    {
      "nisn": "0106137139",
      "name": "ZARKASYINA RAMADHANI",
      "className": "X E",
      "active": true,
      "id": "stu-csv-1795880353567-170"
    },
    {
      "nisn": "0102675188",
      "name": "Abdul Alhadi Arkan",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-171"
    },
    {
      "nisn": "0104624496",
      "name": "ABDUL ROHIM",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-172"
    },
    {
      "nisn": "0103404634",
      "name": "AFDHAL ZULVIANDA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-173"
    },
    {
      "nisn": "0107263209",
      "name": "AFFAN ARRABI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-174"
    },
    {
      "nisn": "0097286982",
      "name": "Alif Rahman",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-175"
    },
    {
      "nisn": "0108245864",
      "name": "ANISA AULIA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-176"
    },
    {
      "nisn": "0106535622",
      "name": "ANNISAH RAMADANI HASIBUAN",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-177"
    },
    {
      "nisn": "0093311772",
      "name": "APRIL QUEEN MADINAH PUTRI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-178"
    },
    {
      "nisn": "0102057648",
      "name": "AUDI JULIANI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-179"
    },
    {
      "nisn": "0101815868",
      "name": "AULIA NUR HADINDA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-180"
    },
    {
      "nisn": "0104647596",
      "name": "BALQIS NOVITA PUTRI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-181"
    },
    {
      "nisn": "0105712516",
      "name": "CHETLYN PAULINA NAINGGOLAN",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-182"
    },
    {
      "nisn": "0105534535",
      "name": "EKA TRI PUTRA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-183"
    },
    {
      "nisn": "0106973888",
      "name": "EVI INDAH LESTARI BR MANULLANG",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-184"
    },
    {
      "nisn": "0105492661",
      "name": "KAMILAH NAJWA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-185"
    },
    {
      "nisn": "0101844641",
      "name": "KESYA NUR AIRA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-186"
    },
    {
      "nisn": "0096846008",
      "name": "KHAYLA NASWAA BR MARPAUNG",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-187"
    },
    {
      "nisn": "0092841948",
      "name": "KRISTY PATRESIA BR MENDROFA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-188"
    },
    {
      "nisn": "0093528581",
      "name": "M Aidil Setiawan",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-189"
    },
    {
      "nisn": "0103375957",
      "name": "M FAJAR SHIDDIQ",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-190"
    },
    {
      "nisn": "0092635863",
      "name": "Mei Rohni Imanita Saragih",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-191"
    },
    {
      "nisn": "0106778435",
      "name": "NATASYA PUTRI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-192"
    },
    {
      "nisn": "0106131042",
      "name": "NAYZHYRA INSANI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-193"
    },
    {
      "nisn": "0098606089",
      "name": "NAZWA AQILLA PUTRI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-194"
    },
    {
      "nisn": "0096928697",
      "name": "OLORIA SITANGGANG",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-195"
    },
    {
      "nisn": "0104275157",
      "name": "RANIA CINDY HAFIZA BR SITORUS",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-196"
    },
    {
      "nisn": "0091877938",
      "name": "REGINA MARGARETHA TARIHORAN",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-197"
    },
    {
      "nisn": "0102628937",
      "name": "SASKIA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-198"
    },
    {
      "nisn": "0097854714",
      "name": "SILFA WIDI ZIANTI NUGROHO",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-199"
    },
    {
      "nisn": "0091590021",
      "name": "Silfiana Lestari",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-200"
    },
    {
      "nisn": "0103058084",
      "name": "TASYA AMELIA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-201"
    },
    {
      "nisn": "0104497566",
      "name": "THARA ASSIFA AMRI",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-202"
    },
    {
      "nisn": "0103167797",
      "name": "WILDA ALIFAH FARHANA",
      "className": "XI A",
      "active": true,
      "id": "stu-csv-1795880353567-203"
    },
    {
      "nisn": "0107133725",
      "name": "Aldo Hardian Pratama",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-204"
    },
    {
      "nisn": "0103930443",
      "name": "ALFIN ADRIANSYAH",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-205"
    },
    {
      "nisn": "0101225342",
      "name": "ANISA ARAMA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-206"
    },
    {
      "nisn": "0099611249",
      "name": "AQILA SYARIFA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-207"
    },
    {
      "nisn": "0091769676",
      "name": "AURA AMELIA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-208"
    },
    {
      "nisn": "0104106576",
      "name": "AZZAHRA APRIANTI ARDIAN",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-209"
    },
    {
      "nisn": "0101020741",
      "name": "CHRISABEL MARETTA SITINDAON",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-210"
    },
    {
      "nisn": "0105292964",
      "name": "DANIEL TAPIAN LASTUA LUMBAN RAJA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-211"
    },
    {
      "nisn": "0106203583",
      "name": "Devgan Timoteus",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-212"
    },
    {
      "nisn": "0091941826",
      "name": "EMIA NOVETA LINA BR GINTING",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-213"
    },
    {
      "nisn": "0104480097",
      "name": "ERWINA PUTRI EVAGELISA SIMBOLON",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-214"
    },
    {
      "nisn": "0102785333",
      "name": "KRISTIAN HERDINO SITOMPUL",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-215"
    },
    {
      "nisn": "0097738436",
      "name": "KRISTINA SIMANJUNTAK",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-216"
    },
    {
      "nisn": "0107400103",
      "name": "LETISIA AMANDA BR KABAN",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-217"
    },
    {
      "nisn": "0101850104",
      "name": "LUTHFIA FARHANA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-218"
    },
    {
      "nisn": "0108602916",
      "name": "MALKA SYARIF FIRDAUS",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-219"
    },
    {
      "nisn": "0102305420",
      "name": "MAYA ARDILA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-220"
    },
    {
      "nisn": "0097087250",
      "name": "NABILA NAZILAH FITRI",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-221"
    },
    {
      "nisn": "0106727259",
      "name": "NAZYLA AQILLA PUTRI",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-222"
    },
    {
      "nisn": "0101830040",
      "name": "Nidia Aura Sastra",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-223"
    },
    {
      "nisn": "0073013708",
      "name": "NOVIRLINA GULO",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-224"
    },
    {
      "nisn": "0101724412",
      "name": "NUR HALIZA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-225"
    },
    {
      "nisn": "0107289441",
      "name": "P BAYO ENGGAN SRG",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-226"
    },
    {
      "nisn": "0101215583",
      "name": "RICARDO NABABAN",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-227"
    },
    {
      "nisn": "0106046323",
      "name": "RISKA FEBY ANA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-228"
    },
    {
      "nisn": "0107660281",
      "name": "ROSLIN CHELSY OKTAVIA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-229"
    },
    {
      "nisn": "0098630958",
      "name": "SHALFAIRA KHAIRUNNISA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-230"
    },
    {
      "nisn": "0107809152",
      "name": "Silvi Laurensia Br Sinaga",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-231"
    },
    {
      "nisn": "0161901912",
      "name": "SITI MALINDA BR MANURUNG",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-232"
    },
    {
      "nisn": "0091126793",
      "name": "TABITA SEPTIA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-233"
    },
    {
      "nisn": "0101530310",
      "name": "TRI OKTAVIA BR SINAGA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-234"
    },
    {
      "nisn": "0105943201",
      "name": "YOBEL V SIHALOHO",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-235"
    },
    {
      "nisn": "0107408791",
      "name": "ZAHIRA ANANDA HARAHAP",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-236"
    },
    {
      "nisn": "0103899000",
      "name": "ZIO ARGATAMA SINAGA",
      "className": "XI B",
      "active": true,
      "id": "stu-csv-1795880353567-237"
    },
    {
      "nisn": "0109763251",
      "name": "AL KHUSNA RAMADANI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-238"
    },
    {
      "nisn": "0096818719",
      "name": "ANANDA PUTRA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-239"
    },
    {
      "nisn": "0093692303",
      "name": "BARUM RUSMANTO",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-240"
    },
    {
      "nisn": "0108658863",
      "name": "BOY RIDWAN SIAHAAN",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-241"
    },
    {
      "nisn": "0109374745",
      "name": "CHACA NOVELLIYA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-242"
    },
    {
      "nisn": "0102200571",
      "name": "Cristiani Romatua Br Sihite",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-243"
    },
    {
      "nisn": "0106647059",
      "name": "CRISTINE ADELIA SAMOSIR",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-244"
    },
    {
      "nisn": "0098333202",
      "name": "Daniel Amos Saputra",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-245"
    },
    {
      "nisn": "0106095915",
      "name": "DELLA ANITA SAHBANIA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-246"
    },
    {
      "nisn": "0098991471",
      "name": "DIARA SABITA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-247"
    },
    {
      "nisn": "0103229088",
      "name": "FINTA LESTARI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-248"
    },
    {
      "nisn": "0096872751",
      "name": "FRANCISKO RP SIMBOLON",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-249"
    },
    {
      "nisn": "0098888033",
      "name": "HANDIKA PUTRA RAMADHAN",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-250"
    },
    {
      "nisn": "0095055946",
      "name": "JON FERI NAINGGOLAN",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-251"
    },
    {
      "nisn": "0104972798",
      "name": "Lyra Dwi Saskia",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-252"
    },
    {
      "nisn": "0093655945",
      "name": "MAILA ATIFA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-253"
    },
    {
      "nisn": "0104503379",
      "name": "Melinda Br Pasaribu",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-254"
    },
    {
      "nisn": "0094405524",
      "name": "MUHAMMAD REZA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-255"
    },
    {
      "nisn": "0097027058",
      "name": "MUHAMMAD TAUFIQO",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-256"
    },
    {
      "nisn": "0106438477",
      "name": "Muhammadun Afsel",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-257"
    },
    {
      "nisn": "0091640242",
      "name": "NURHAMIZAH",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-258"
    },
    {
      "nisn": "0095448261",
      "name": "Pina Aulia",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-259"
    },
    {
      "nisn": "0108388612",
      "name": "Puspitasari Pakpahan",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-260"
    },
    {
      "nisn": "0094877692",
      "name": "PUTRI ENJELINA BR GULTOM",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-261"
    },
    {
      "nisn": "3094932461",
      "name": "PUTRI PERMATA YUNDA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-262"
    },
    {
      "nisn": "0097866992",
      "name": "RAFI FAUZAN",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-263"
    },
    {
      "nisn": "0105256870",
      "name": "RIANA SYAHPUTRI SIMAMORA",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-264"
    },
    {
      "nisn": "0101310629",
      "name": "RIFA KHAIRANI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-265"
    },
    {
      "nisn": "0091455886",
      "name": "RIO AFANDI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-266"
    },
    {
      "nisn": "0101424754",
      "name": "Saskia Afrilia",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-267"
    },
    {
      "nisn": "0097877211",
      "name": "SILVIA INDRI WULANDARI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-268"
    },
    {
      "nisn": "0102058440",
      "name": "WENNI RAHMATTILAH",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-269"
    },
    {
      "nisn": "0106031864",
      "name": "ZIANYA CAHAYA INARI",
      "className": "XI C",
      "active": true,
      "id": "stu-csv-1795880353567-270"
    },
    {
      "nisn": "0097740630",
      "name": "ALDANIA ARRAHMA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-271"
    },
    {
      "nisn": "0095117603",
      "name": "ALFREDO SIRAIT",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-272"
    },
    {
      "nisn": "0097400921",
      "name": "ALYA LINTANG ARYANI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-273"
    },
    {
      "nisn": "0105016658",
      "name": "AMIRUL SARAGIH",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-274"
    },
    {
      "nisn": "0091184243",
      "name": "ANDRE NOVENSIUS SIALLAGAN",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-275"
    },
    {
      "nisn": "0105588083",
      "name": "AQILA AIDIL ASTU",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-276"
    },
    {
      "nisn": "0106912002",
      "name": "ARYA AL FARIS",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-277"
    },
    {
      "nisn": "0099534601",
      "name": "AYU WANDIRA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-278"
    },
    {
      "nisn": "0109305746",
      "name": "AYUB NATANAEL SIDABUTAR",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-279"
    },
    {
      "nisn": "0093500028",
      "name": "BERKAT UMBU CAHYANTO MENDROFA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-280"
    },
    {
      "nisn": "0102672665",
      "name": "BILQISS FATIHA REZIGHI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-281"
    },
    {
      "nisn": "0098034906",
      "name": "DIAH SORAYA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-282"
    },
    {
      "nisn": "0102584387",
      "name": "Elvina",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-283"
    },
    {
      "nisn": "0097574335",
      "name": "M YUDHA DIRLY",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-284"
    },
    {
      "nisn": "0103762958",
      "name": "MIZA AULIYA KRISTI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-285"
    },
    {
      "nisn": "0091477364",
      "name": "MRifky Arkana",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-286"
    },
    {
      "nisn": "0109287036",
      "name": "NACILA SAFITRI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-287"
    },
    {
      "nisn": "0097661096",
      "name": "NAILA SAPUTRI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-288"
    },
    {
      "nisn": "0095995279",
      "name": "NUR AMELIA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-289"
    },
    {
      "nisn": "0103595858",
      "name": "NUR KHOLIZA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-290"
    },
    {
      "nisn": "0096103573",
      "name": "PRISA JAYA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-291"
    },
    {
      "nisn": "0099829258",
      "name": "PUJA SONJAYA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-292"
    },
    {
      "nisn": "0098342681",
      "name": "RAHMAN RAMADHAN",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-293"
    },
    {
      "nisn": "0095980890",
      "name": "Rando Hasugian",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-294"
    },
    {
      "nisn": "0105318216",
      "name": "REFA YULITA BR SIANTURI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-295"
    },
    {
      "nisn": "0089388849",
      "name": "RIYANA RAMADANI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-296"
    },
    {
      "nisn": "0103317929",
      "name": "SRI MUZDALIFAH",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-297"
    },
    {
      "nisn": "0096377411",
      "name": "Suci Nur Amelia",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-298"
    },
    {
      "nisn": "0096071215",
      "name": "SURATDI",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-299"
    },
    {
      "nisn": "0106765651",
      "name": "TANIA SALSABILA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-300"
    },
    {
      "nisn": "0097328897",
      "name": "TAQIA MAFASA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-301"
    },
    {
      "nisn": "0104731287",
      "name": "WENNTI RAHMATILAH",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-302"
    },
    {
      "nisn": "0102262973",
      "name": "ZAKIYA HARSITA",
      "className": "XI D",
      "active": true,
      "id": "stu-csv-1795880353568-303"
    },
    {
      "nisn": "0101899623",
      "name": "ADJI FEBRIANDA PRAMESTIO",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-304"
    },
    {
      "nisn": "0078926406",
      "name": "AHMAD ARIS FIRMANSYAH",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-305"
    },
    {
      "nisn": "0103273953",
      "name": "ALFIANSYAH LUBIS",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-306"
    },
    {
      "nisn": "0099067690",
      "name": "DEBY PUSPITA LBN TORUAN",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-307"
    },
    {
      "nisn": "0101331068",
      "name": "Devano Aurel Prahara",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-308"
    },
    {
      "nisn": "0104159865",
      "name": "DHINI OKTAVIA",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-309"
    },
    {
      "nisn": "0095761295",
      "name": "FANISIA KRISTIANI HUTABARAT",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-310"
    },
    {
      "nisn": "0107510089",
      "name": "FEBI YOLANDA",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-311"
    },
    {
      "nisn": "0092090350",
      "name": "GERRAD RAFAEL SIMANUNGKALIT",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-312"
    },
    {
      "nisn": "0099410856",
      "name": "HELDALIA BAKTI RAHMADANI",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-313"
    },
    {
      "nisn": "0108052758",
      "name": "HERLINA BR TOGATOROP",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-314"
    },
    {
      "nisn": "0102864037",
      "name": "ILANNIATI",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-315"
    },
    {
      "nisn": "0106225247",
      "name": "JESI ROSIANA BR SARAGIH",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-316"
    },
    {
      "nisn": "0107302565",
      "name": "KEVIN MUSA TAMBUNAN",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-317"
    },
    {
      "nisn": "0094904884",
      "name": "Kezia Cahyani",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-318"
    },
    {
      "nisn": "0103523496",
      "name": "M. ALGAFIQI HERI",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-319"
    },
    {
      "nisn": "0101036162",
      "name": "M. MUHADIR",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-320"
    },
    {
      "nisn": "0107646295",
      "name": "MELVI SINAGA",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-321"
    },
    {
      "nisn": "0082774305",
      "name": "Muhammad Adil Fahri",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-322"
    },
    {
      "nisn": "0104347149",
      "name": "MUHAMMAD AL KHALIF",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-323"
    },
    {
      "nisn": "0103494872",
      "name": "Muhammad Rafvi Al Bukhori",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-324"
    },
    {
      "nisn": "0107247662",
      "name": "NABILLA EKA PERTIWI",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-325"
    },
    {
      "nisn": "0103514234",
      "name": "NADIN EVELIN PANJAITAN",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-326"
    },
    {
      "nisn": "0107098707",
      "name": "NAJWA IDFI AULIA",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-327"
    },
    {
      "nisn": "0105170030",
      "name": "Naufal Albahi",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-328"
    },
    {
      "nisn": "0092217839",
      "name": "NIKE ARDILA GULO",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-329"
    },
    {
      "nisn": "0105639395",
      "name": "Rangga Pratama",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-330"
    },
    {
      "nisn": "0075558722",
      "name": "REFAN LUCKI SAMOSIR",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-331"
    },
    {
      "nisn": "0108353685",
      "name": "ROCKY ANANDA YAHYA SIREGAR",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-332"
    },
    {
      "nisn": "0102445510",
      "name": "SAMUEL SETIADY SAMOSIR",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-333"
    },
    {
      "nisn": "0101100903",
      "name": "SICI LIA MEGA SAPUTRI",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-334"
    },
    {
      "nisn": "0099689543",
      "name": "SITI RAMADHANI SIMANJUNTAK",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-335"
    },
    {
      "nisn": "0103200764",
      "name": "Teresya Sondang R.S",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-336"
    },
    {
      "nisn": "0106034597",
      "name": "ZAHRATUL SITA",
      "className": "XI E",
      "active": true,
      "id": "stu-csv-1795880353568-337"
    },
    {
      "nisn": "0088738900",
      "name": "Afif Amrullah",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-338"
    },
    {
      "nisn": "0096958485",
      "name": "AFRIDO PARPUNGUAN SIPAHUTAR",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-339"
    },
    {
      "nisn": "0089742054",
      "name": "Agnes Br. Simangunsong",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-340"
    },
    {
      "nisn": "0088491857",
      "name": "BUNGA AWALIYA NOVRIZA",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-341"
    },
    {
      "nisn": "0092906491",
      "name": "CHYNTIA ANGELINA OCTAVIANI",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-342"
    },
    {
      "nisn": "0097772566",
      "name": "Eca Seftri Anisyah",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-343"
    },
    {
      "nisn": "0092416049",
      "name": "GILANG DWI CAHYO",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-344"
    },
    {
      "nisn": "0091277265",
      "name": "HARIYANADA AFDANI",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-345"
    },
    {
      "nisn": "0097241019",
      "name": "Harmi Yati",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-346"
    },
    {
      "nisn": "0096685056",
      "name": "IMERALDO SIRINGORINGO",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-347"
    },
    {
      "nisn": "0082860497",
      "name": "Iren Zalaranu",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-348"
    },
    {
      "nisn": "0099444699",
      "name": "JENIFER APRILLIA SIMANJUNTAK",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-349"
    },
    {
      "nisn": "0095245094",
      "name": "JONATAN ARITONANG",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-350"
    },
    {
      "nisn": "0096743606",
      "name": "JULY ANGGIAN",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-351"
    },
    {
      "nisn": "0087474859",
      "name": "Lukman Saputra",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-352"
    },
    {
      "nisn": "0082728041",
      "name": "M. FATIH AL KARIM",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-353"
    },
    {
      "nisn": "0093937684",
      "name": "MARDELINA NAINGGOLAN",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-354"
    },
    {
      "nisn": "0091586362",
      "name": "MARVEL ANDREAN SINAGA",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-355"
    },
    {
      "nisn": "0096889919",
      "name": "MUHAMMAD DELFITRAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-356"
    },
    {
      "nisn": "0089367728",
      "name": "NAZUA AULIA SAFITRI",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-357"
    },
    {
      "nisn": "0091001164",
      "name": "NOVA LESTARI",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-358"
    },
    {
      "nisn": "0081380388",
      "name": "NOVAL ALVIANSYAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-359"
    },
    {
      "nisn": "0098898597",
      "name": "Rahmatul Sadi",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-360"
    },
    {
      "nisn": "0107943761",
      "name": "REZEKI MARBUN",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-361"
    },
    {
      "nisn": "0099657825",
      "name": "RIPKA SRI ASTARI GULO",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-362"
    },
    {
      "nisn": "0083226664",
      "name": "SALSA BILA NADHIFAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-363"
    },
    {
      "nisn": "0082516939",
      "name": "SITI MAGHFIROTUL JANAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-364"
    },
    {
      "nisn": "0097464085",
      "name": "Tri Kennedy Hutauruk",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-365"
    },
    {
      "nisn": "0091165651",
      "name": "VINDI FADILLAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-366"
    },
    {
      "nisn": "0061811447",
      "name": "WANISAH EFELI BR SIANIPAR",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-367"
    },
    {
      "nisn": "0082433391",
      "name": "YANICHA DELTARI BR TAMBUNAN",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-368"
    },
    {
      "nisn": "0081612353",
      "name": "ZARA HALIMA TUSSADIAH",
      "className": "XII A",
      "active": true,
      "id": "stu-csv-1795880353568-369"
    },
    {
      "nisn": "0092386819",
      "name": "ALWIRA ILHAM",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-370"
    },
    {
      "nisn": "0081690120",
      "name": "ANDESKA RIDHO PRATAMA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-371"
    },
    {
      "nisn": "0099968537",
      "name": "ANGELA BR SIANIPAR",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-372"
    },
    {
      "nisn": "0097154560",
      "name": "APSARI PUTRI",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-373"
    },
    {
      "nisn": "0095783138",
      "name": "ARIQ ALVINO",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-374"
    },
    {
      "nisn": "0082668958",
      "name": "ARNOLD STEVEN PASDO ALIAMAN",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-375"
    },
    {
      "nisn": "0099780251",
      "name": "BERNANDUS PRATAMA LBN BATU",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-376"
    },
    {
      "nisn": "0099840450",
      "name": "CHERLIN WANA LESTARI TELAUMBANUA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-377"
    },
    {
      "nisn": "0085480391",
      "name": "DWI CHELSE EFENDI SINAGA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-378"
    },
    {
      "nisn": "0082416549",
      "name": "DWY DESFRIANA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-379"
    },
    {
      "nisn": "0095397779",
      "name": "EBEN HAEZER NAINGGOLAN",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-380"
    },
    {
      "nisn": "0086457960",
      "name": "Erna uli sinaga",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-381"
    },
    {
      "nisn": "0098924888",
      "name": "ESRA HUTAHAYAN",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-382"
    },
    {
      "nisn": "0095767676",
      "name": "FAIBA FAHMA MILLATI",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-383"
    },
    {
      "nisn": "0085663016",
      "name": "FIRDAUS NIZAM ABROR",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-384"
    },
    {
      "nisn": "0084697139",
      "name": "Hidayat Maulana",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-385"
    },
    {
      "nisn": "0087237648",
      "name": "Joshua Martinus Hasibuan",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-386"
    },
    {
      "nisn": "0083045606",
      "name": "JUM'ATUL AKMALIA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-387"
    },
    {
      "nisn": "0092304091",
      "name": "KHAIRUL AQIL AFIF",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-388"
    },
    {
      "nisn": "0096116660",
      "name": "KHILAL HABIYYU DAMANIK",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-389"
    },
    {
      "nisn": "0071804696",
      "name": "LEVIANI ZEGA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-390"
    },
    {
      "nisn": "0095173514",
      "name": "LIONEL MELQIANO",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-391"
    },
    {
      "nisn": "0082504643",
      "name": "NEZHA INDIRA PUTRI",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-392"
    },
    {
      "nisn": "0091546082",
      "name": "PETRA EBEN HAEZER SIANTURI",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-393"
    },
    {
      "nisn": "0099682228",
      "name": "RACHEL MARIAM SINURAT",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-394"
    },
    {
      "nisn": "3086825321",
      "name": "Reygita Nasyabila Rahma",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-395"
    },
    {
      "nisn": "0094041045",
      "name": "REZKY ARDIANSYAH BATU BARA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-396"
    },
    {
      "nisn": "0098247832",
      "name": "RIRIS DIANA BR MANIK",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-397"
    },
    {
      "nisn": "0091988852",
      "name": "RIZKY ARIYANTI BR GINTING",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-398"
    },
    {
      "nisn": "0084619280",
      "name": "SETIA SRI WAHYUNI BR GULTOM",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-399"
    },
    {
      "nisn": "0091053239",
      "name": "TIARA FEBY HILZAYANTI",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-400"
    },
    {
      "nisn": "0088538891",
      "name": "TRI ALFAUZAN",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-401"
    },
    {
      "nisn": "0099319864",
      "name": "WILLIAM DAVID MANALU",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-402"
    },
    {
      "nisn": "0094012800",
      "name": "ZHIVANA",
      "className": "XII B",
      "active": true,
      "id": "stu-csv-1795880353568-403"
    },
    {
      "nisn": "0096828013",
      "name": "AGEL RISKY",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-404"
    },
    {
      "nisn": "0081724515",
      "name": "ARDI LAIA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-405"
    },
    {
      "nisn": "0088671152",
      "name": "BINTANG AIDAN AIDIR",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-406"
    },
    {
      "nisn": "0089722162",
      "name": "CRAISTIN CONSTIAN BR PASARIBU",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-407"
    },
    {
      "nisn": "0098833889",
      "name": "DWIKA CINTYA DEWI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-408"
    },
    {
      "nisn": "0091351802",
      "name": "ERNEST NETANEEL HUTABARAT",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-409"
    },
    {
      "nisn": "0081546264",
      "name": "EVIVA ANGGRAINI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-410"
    },
    {
      "nisn": "0085402869",
      "name": "FARISA NUR AFIAH BR SITOMPUL",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-411"
    },
    {
      "nisn": "0094673726",
      "name": "FEVRIANJA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-412"
    },
    {
      "nisn": "0089963782",
      "name": "FIRMAN GIAWA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-413"
    },
    {
      "nisn": "0091279011",
      "name": "FIRMAN PURBA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-414"
    },
    {
      "nisn": "0094351251",
      "name": "GILANG FAHRIANSYAH",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-415"
    },
    {
      "nisn": "0089545259",
      "name": "IMELDA KHANXA FITRIA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-416"
    },
    {
      "nisn": "0096968870",
      "name": "IRDINA ERMA PUTRI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-417"
    },
    {
      "nisn": "0099617696",
      "name": "IRENE MARIA SIDABUTAR",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-418"
    },
    {
      "nisn": "3147091915",
      "name": "LIDYA GYSELA Br SITINJAK",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-419"
    },
    {
      "nisn": "0093439805",
      "name": "M. ALDAFFA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-420"
    },
    {
      "nisn": "0094151007",
      "name": "M.Zacky",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-421"
    },
    {
      "nisn": "0095393485",
      "name": "MARCHEL DARIUS SIHITE",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-422"
    },
    {
      "nisn": "0085419166",
      "name": "MELLY NOVIYANTI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-423"
    },
    {
      "nisn": "0096344205",
      "name": "Muhammad Ilham",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-424"
    },
    {
      "nisn": "0083231890",
      "name": "MUHAMMAD SYUHADI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-425"
    },
    {
      "nisn": "0092331002",
      "name": "PUTRI AGARA",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-426"
    },
    {
      "nisn": "0072074502",
      "name": "PUTRI JELITA BR SIMANJUNTAK",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-427"
    },
    {
      "nisn": "0097047442",
      "name": "RAFAEL CARLOS SIMBOLON",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-428"
    },
    {
      "nisn": "0099762213",
      "name": "REYHAN RISKI RAMADHAN",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-429"
    },
    {
      "nisn": "0095013855",
      "name": "ROSINDA NAINGGOLAN",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-430"
    },
    {
      "nisn": "0094528620",
      "name": "SAMUEL KRISTIAN.M",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-431"
    },
    {
      "nisn": "0076425765",
      "name": "SETIA VANI LAOLI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-432"
    },
    {
      "nisn": "0096820912",
      "name": "ULFA AINI",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-433"
    },
    {
      "nisn": "0095691938",
      "name": "Yolanda",
      "className": "XII C",
      "active": true,
      "id": "stu-csv-1795880353568-434"
    },
    {
      "nisn": "0094479872",
      "name": "ABDUL DAFFA AZHARI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-435"
    },
    {
      "nisn": "0091055091",
      "name": "AFNI RAMADHAN",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-436"
    },
    {
      "nisn": "0094680960",
      "name": "ANA LAURA PAULINA SIBARANI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-437"
    },
    {
      "nisn": "0095640163",
      "name": "ARIAL ALFARIZI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-438"
    },
    {
      "nisn": "0094254504",
      "name": "BENNY SANJAYA SIMARMATA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-439"
    },
    {
      "nisn": "0066369582",
      "name": "CICI JULAYKA RAMADHANI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-440"
    },
    {
      "nisn": "0085042347",
      "name": "DAFA MUFADOL ANDESRIZAL",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-441"
    },
    {
      "nisn": "0087331976",
      "name": "DANIEL NAINGGOLAN",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-442"
    },
    {
      "nisn": "0085589690",
      "name": "DHEA RIONY AGUSTIN",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-443"
    },
    {
      "nisn": "0095689366",
      "name": "Dian karina Br saragih",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-444"
    },
    {
      "nisn": "0099661833",
      "name": "DWI EVIANA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-445"
    },
    {
      "nisn": "0085440954",
      "name": "FERDY ARZALI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-446"
    },
    {
      "nisn": "0086046359",
      "name": "FRANATA STEVANUS MANULLANG",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-447"
    },
    {
      "nisn": "0074771739",
      "name": "Indra Alyiranto Hutagalung",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-448"
    },
    {
      "nisn": "0096862402",
      "name": "JHON SAMUEL SIMATUPANG",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-449"
    },
    {
      "nisn": "0093046013",
      "name": "JOY STEVEN SIMANGUNSONG",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-450"
    },
    {
      "nisn": "0095739589",
      "name": "MARVEL VANKASTON SITUMORANG",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-451"
    },
    {
      "nisn": "0096341961",
      "name": "MAWAR TASYA BR. SIMAMORA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-452"
    },
    {
      "nisn": "0085042160",
      "name": "MUHAMMAD BAYU LUBIS",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-453"
    },
    {
      "nisn": "0084035614",
      "name": "MUHAMMAD HAMIDI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-454"
    },
    {
      "nisn": "0096719359",
      "name": "NOVITA EZRAWATI ZEGA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-455"
    },
    {
      "nisn": "0099299910",
      "name": "QALBI ZANJABIL",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-456"
    },
    {
      "nisn": "0099379830",
      "name": "RAFLI ANDRIANSYAH GIRSANG",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-457"
    },
    {
      "nisn": "0093740976",
      "name": "REZKI NOVRIANI GARINGGING",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-458"
    },
    {
      "nisn": "0087347388",
      "name": "RIFQI RAMADHAN",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-459"
    },
    {
      "nisn": "0093772798",
      "name": "Ruben Dominggo Manurung",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-460"
    },
    {
      "nisn": "0078935260",
      "name": "SELVIA PUTRI HAREFA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-461"
    },
    {
      "nisn": "0092000684",
      "name": "SYLA NOVALIA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-462"
    },
    {
      "nisn": "0083795062",
      "name": "TASYA ANGGRAINI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-463"
    },
    {
      "nisn": "0092451971",
      "name": "TEDY AKMALDI",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-464"
    },
    {
      "nisn": "0098796408",
      "name": "TRIANA NOVALINA",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-465"
    },
    {
      "nisn": "0109290719",
      "name": "VRANSCO CORNELIUS TAMPUBOLON",
      "className": "XII D",
      "active": true,
      "id": "stu-csv-1795880353568-466"
    },
    {
      "nisn": "0094712372",
      "name": "AGRA SETIA PUTRA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-467"
    },
    {
      "nisn": "0086966404",
      "name": "ANNISA DWI NOVIYANTI",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-468"
    },
    {
      "nisn": "0081820251",
      "name": "ASRINA SARI SIREGAR",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-469"
    },
    {
      "nisn": "0085931672",
      "name": "David Sanjaya S",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-470"
    },
    {
      "nisn": "0091705467",
      "name": "DINDA MARGARETH SINAGA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-471"
    },
    {
      "nisn": "0085545648",
      "name": "ELSA ATIAN NINGRUM",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-472"
    },
    {
      "nisn": "0095263323",
      "name": "ELVIRA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-473"
    },
    {
      "nisn": "0096971391",
      "name": "FAHRI AZIZI DAMANIK",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-474"
    },
    {
      "nisn": "0095366081",
      "name": "FAIZ ALFARICI",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-475"
    },
    {
      "nisn": "0086706361",
      "name": "FASKA SELVINA LUMBAN GAOL",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-476"
    },
    {
      "nisn": "0086336840",
      "name": "GISHEILA NATALIA SIAHAAN",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-477"
    },
    {
      "nisn": "0087525973",
      "name": "HARI KORDIAS SAMOSIR",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-478"
    },
    {
      "nisn": "0099405937",
      "name": "JUN PARLINDUNGAN WARUHU",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-479"
    },
    {
      "nisn": "0091016216",
      "name": "LASTRI OLIVIA SIHOTANG",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-480"
    },
    {
      "nisn": "0099378225",
      "name": "LOLA ANDRIANI NASUTION",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-481"
    },
    {
      "nisn": "0094834295",
      "name": "MEI RUSLINA BR SIBURIAN",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-482"
    },
    {
      "nisn": "0086385740",
      "name": "MUHAMMAD ALAUDIN LUDFI",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-483"
    },
    {
      "nisn": "0096970349",
      "name": "Muhammad Zaki Nasuha",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-484"
    },
    {
      "nisn": "0095927204",
      "name": "NOBEL IGNASIUS NAIBAHO",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-485"
    },
    {
      "nisn": "0091038927",
      "name": "NOFITA AMANDA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-486"
    },
    {
      "nisn": "0078080473",
      "name": "PARIJON SINAGA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-487"
    },
    {
      "nisn": "0092007297",
      "name": "PENTY KIRANA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-488"
    },
    {
      "nisn": "0095920535",
      "name": "PUTRI ULFA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-489"
    },
    {
      "nisn": "0081580807",
      "name": "RADEN PANJI PUTRA GITI",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-490"
    },
    {
      "nisn": "0087526352",
      "name": "REHAN DIKA RIZKY PUTRA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-491"
    },
    {
      "nisn": "0083035185",
      "name": "RODINA BR SIANIPAR",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-492"
    },
    {
      "nisn": "0088668965",
      "name": "SANTA FREDALITA BR SARAGIH",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-493"
    },
    {
      "nisn": "0087222013",
      "name": "Sefri Yadi Erlanda",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-494"
    },
    {
      "nisn": "0099673593",
      "name": "SETIA ANGGUN PURBA",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-495"
    },
    {
      "nisn": "0092947846",
      "name": "THAHARA JOTI NUR",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-496"
    },
    {
      "nisn": "0088123898",
      "name": "TITIN NIKMA WATI",
      "className": "XII E",
      "active": true,
      "id": "stu-csv-1795880353568-497"
    }
  ],
  "packages": [
    {
      "id": "pkg-1795880547658",
      "teacherId": "teacher-1795880402472",
      "title": "Ulangan Harian - Materi Teks Prosedur",
      "subject": "Bahasa Indonesia",
      "targetClasses": [
        "XI E",
        "XI D"
      ],
      "category": "Ulangan Resmi",
      "durationMinutes": 60,
      "minSubmitMinutes": 15,
      "kkm": 75,
      "token": "4DGURY",
      "shuffleQuestions": true,
      "shuffleOptions": true,
      "isPublished": true,
      "allowIndependentAccess": true,
      "teacherActivatedAt": "2026-11-28T15:42:27.659Z",
      "createdAt": "2026-11-28T15:42:27.659Z"
    }
  ],
  "questions": [
    {
      "id": "q-imp-1795880578927-0",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Teks yang berisi langkah-langkah atau tahapan yang harus ditempuh untuk mencapai suatu tujuan tertentu disebut teks ....",
      "options": [
        {
          "id": "A",
          "text": "eksplanasi"
        },
        {
          "id": "B",
          "text": "prosedur"
        },
        {
          "id": "C",
          "text": "laporan hasil observasi"
        },
        {
          "id": "D",
          "text": "eksposisi"
        },
        {
          "id": "E",
          "text": "negosiasi"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-1",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Struktur teks prosedur yang berisi pengantar mengenai topik yang akan dijelaskan dalam teks adalah bagian ....",
      "options": [
        {
          "id": "A",
          "text": "langkah-langkah"
        },
        {
          "id": "B",
          "text": "penegasan ulang"
        },
        {
          "id": "C",
          "text": "pernyataan umum"
        },
        {
          "id": "D",
          "text": "tujuan"
        },
        {
          "id": "E",
          "text": "alat dan bahan"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-2",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! Cara Membuat Masker Wajah Alami dari Madu dan Jeruk Nipis. Kutipan tersebut merupakan bagian dari struktur teks prosedur, yaitu ....",
      "options": [
        {
          "id": "A",
          "text": "tujuan"
        },
        {
          "id": "B",
          "text": "langkah-langkah"
        },
        {
          "id": "C",
          "text": "penegasan ulang"
        },
        {
          "id": "D",
          "text": "material"
        },
        {
          "id": "E",
          "text": "simpulan"
        }
      ],
      "correctOptionId": "A",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-3",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kalimat berikut! Tuangkan 200 ml air hangat ke dalam gelas, lalu aduk hingga gula larut. Kata kerja yang bercetak miring (tuangkan, aduk) termasuk jenis kata kerja ....",
      "options": [
        {
          "id": "A",
          "text": "pasif"
        },
        {
          "id": "B",
          "text": "mental"
        },
        {
          "id": "C",
          "text": "imperatif"
        },
        {
          "id": "D",
          "text": "relasional"
        },
        {
          "id": "E",
          "text": "material"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-4",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Konjungsi yang menyatakan urutan waktu dalam teks prosedur disebut konjungsi ....",
      "options": [
        {
          "id": "A",
          "text": "kausalitas"
        },
        {
          "id": "B",
          "text": "temporal"
        },
        {
          "id": "C",
          "text": "syarat"
        },
        {
          "id": "D",
          "text": "tujuan"
        },
        {
          "id": "E",
          "text": "pertentangan"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-5",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Berikut ini yang merupakan contoh konjungsi temporal dalam teks prosedur adalah ....",
      "options": [
        {
          "id": "A",
          "text": "sebab, karena, oleh karena itu"
        },
        {
          "id": "B",
          "text": "jika, apabila, seandainya"
        },
        {
          "id": "C",
          "text": "kemudian, selanjutnya, setelah itu"
        },
        {
          "id": "D",
          "text": "agar, supaya, untuk"
        },
        {
          "id": "E",
          "text": "tetapi, melainkan, sedangkan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-6",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Cermati kalimat berikut! Pastikan kabel daya sudah terpasang dengan benar sebelum menekan tombol power. Kalimat tersebut merupakan jenis kalimat ....",
      "options": [
        {
          "id": "A",
          "text": "interogatif"
        },
        {
          "id": "B",
          "text": "deklaratif"
        },
        {
          "id": "C",
          "text": "imperatif"
        },
        {
          "id": "D",
          "text": "eksklamatif"
        },
        {
          "id": "E",
          "text": "persuasif"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-7",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bagian teks prosedur yang bersifat opsional (boleh ada atau tidak) adalah ....",
      "options": [
        {
          "id": "A",
          "text": "tujuan"
        },
        {
          "id": "B",
          "text": "langkah-langkah"
        },
        {
          "id": "C",
          "text": "alat dan bahan"
        },
        {
          "id": "D",
          "text": "simpulan"
        },
        {
          "id": "E",
          "text": "judul"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-8",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan urutan langkah membuat teh manis berikut! (1) Masukkan teh celup ke dalam gelas. (2) Tambahkan gula pasir secukupnya. (3) Tuangkan air panas ke dalam gelas. (4) Aduk hingga gula larut dan teh siap disajikan. (5) Siapkan gelas dan sendok. Urutan langkah yang tepat adalah ....",
      "options": [
        {
          "id": "A",
          "text": "(5)-(1)-(2)-(3)-(4)"
        },
        {
          "id": "B",
          "text": "(5)-(3)-(1)-(2)-(4)"
        },
        {
          "id": "C",
          "text": "(1)-(2)-(3)-(4)-(5)"
        },
        {
          "id": "D",
          "text": "(5)-(2)-(1)-(3)-(4)"
        },
        {
          "id": "E",
          "text": "(1)-(5)-(2)-(3)-(4)"
        }
      ],
      "correctOptionId": "A",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-9",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Kaidah kebahasaan teks prosedur yang berfungsi memberikan batasan atau ukuran yang jelas pada langkah-langkah disebut ....",
      "options": [
        {
          "id": "A",
          "text": "verba material"
        },
        {
          "id": "B",
          "text": "konjungsi syarat"
        },
        {
          "id": "C",
          "text": "bilangan penanda"
        },
        {
          "id": "D",
          "text": "keterangan cara dan alat"
        },
        {
          "id": "E",
          "text": "kalimat interogatif"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578927-10",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Kalimat yang menggunakan keterangan alat dalam teks prosedur adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Rebuslah mi selama tiga menit hingga matang."
        },
        {
          "id": "B",
          "text": "Potonglah wortel menggunakan pisau yang tajam."
        },
        {
          "id": "C",
          "text": "Aduklah adonan secara perlahan agar tidak menggumpal."
        },
        {
          "id": "D",
          "text": "Diamkan adonan selama kurang lebih 30 menit."
        },
        {
          "id": "E",
          "text": "Sajikan selagi hangat di atas piring saji."
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-11",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan teks prosedur berikut! Jika adonan masih terlalu kental, tambahkan sedikit air matang. Kata jika pada kalimat tersebut merupakan konjungsi ....",
      "options": [
        {
          "id": "A",
          "text": "temporal"
        },
        {
          "id": "B",
          "text": "tujuan"
        },
        {
          "id": "C",
          "text": "syarat"
        },
        {
          "id": "D",
          "text": "sebab-akibat"
        },
        {
          "id": "E",
          "text": "pemilihan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-12",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Teks prosedur kompleks memiliki ciri utama, yaitu ....",
      "options": [
        {
          "id": "A",
          "text": "hanya terdiri atas dua langkah sederhana"
        },
        {
          "id": "B",
          "text": "langkah-langkahnya dapat dibolak-balik"
        },
        {
          "id": "C",
          "text": "memiliki banyak langkah dan sublangkah yang saling berkaitan"
        },
        {
          "id": "D",
          "text": "tidak memerlukan alat dan bahan"
        },
        {
          "id": "E",
          "text": "bertujuan untuk menghibur pembaca"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-13",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kalimat berikut! Anda sebaiknya mengaduk adonan dengan kecepatan rendah. Jika diubah menjadi kalimat imperatif yang efektif, kalimat tersebut menjadi ....",
      "options": [
        {
          "id": "A",
          "text": "Sebaiknya adonan diaduk dengan kecepatan rendah."
        },
        {
          "id": "B",
          "text": "Aduklah adonan dengan kecepatan rendah!"
        },
        {
          "id": "C",
          "text": "Mengapa adonan harus diaduk dengan kecepatan rendah?"
        },
        {
          "id": "D",
          "text": "Adonan diaduk dengan kecepatan rendah oleh Anda."
        },
        {
          "id": "E",
          "text": "Anda mengaduk adonan dengan kecepatan rendah."
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-14",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Berikut ini yang BUKAN merupakan ciri kebahasaan teks prosedur adalah ....",
      "options": [
        {
          "id": "A",
          "text": "banyak menggunakan kata kerja imperatif"
        },
        {
          "id": "B",
          "text": "menggunakan kata-kata teknis sesuai bidangnya"
        },
        {
          "id": "C",
          "text": "banyak menggunakan konjungsi temporal"
        },
        {
          "id": "D",
          "text": "menggunakan kalimat persuasif yang bersifat membujuk"
        },
        {
          "id": "E",
          "text": "menggunakan pernyataan persuasif dan keterangan cara"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-15",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! (1) Kunjungi situs resmi pendaftaran. (2) Isi formulir secara daring dengan data yang valid. (3) Unggah dokumen persyaratan dalam format PDF. (4) Cetak kartu bukti pendaftaran. Topik yang tepat untuk kutipan teks prosedur tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Cara Membuat Akun Media Sosial"
        },
        {
          "id": "B",
          "text": "Prosedur Pendaftaran Seleksi Secara Daring"
        },
        {
          "id": "C",
          "text": "Langkah-Langkah Mengubah Format Dokumen"
        },
        {
          "id": "D",
          "text": "Tata Cara Mencetak Kartu Identitas"
        },
        {
          "id": "E",
          "text": "Panduan Mengakses Internet dengan Aman"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-16",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bagian penutup dalam teks prosedur biasanya berisi ....",
      "options": [
        {
          "id": "A",
          "text": "daftar bahan yang diperlukan"
        },
        {
          "id": "B",
          "text": "langkah awal yang harus dilakukan"
        },
        {
          "id": "C",
          "text": "harapan atau manfaat apabila petunjuk dijalankan dengan baik"
        },
        {
          "id": "D",
          "text": "definisi umum mengenai objek"
        },
        {
          "id": "E",
          "text": "rincian biaya yang dibutuhkan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-17",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kalimat berikut! Rebuslah air hingga mendidih, [...] masukkan mi instan ke dalam panci. Konjungsi yang tepat untuk melengkapi kalimat rumpang tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "sebab"
        },
        {
          "id": "B",
          "text": "meskipun"
        },
        {
          "id": "C",
          "text": "kemudian"
        },
        {
          "id": "D",
          "text": "padahal"
        },
        {
          "id": "E",
          "text": "melainkan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-18",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Kata kerja yang mengacu pada tindakan fisik dalam teks prosedur disebut verba ....",
      "options": [
        {
          "id": "A",
          "text": "mental"
        },
        {
          "id": "B",
          "text": "tingkah laku"
        },
        {
          "id": "C",
          "text": "material"
        },
        {
          "id": "D",
          "text": "relasional"
        },
        {
          "id": "E",
          "text": "pasif"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-19",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Manakah di bawah ini yang termasuk contoh verba material?",
      "options": [
        {
          "id": "A",
          "text": "memikirkan, merasakan, memahami"
        },
        {
          "id": "B",
          "text": "memotong, mengaduk, menuangkan"
        },
        {
          "id": "C",
          "text": "menyukai, menginginkan, menolak"
        },
        {
          "id": "D",
          "text": "merupakan, adalah, menjadi"
        },
        {
          "id": "E",
          "text": "terlihat, tampak, terdengar"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-20",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Cermati pernyataan berikut! Hindari penggunaan pemutih pakaian karena dapat merusak serat kain. Maksud dari pernyataan dalam teks prosedur tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "perintah wajib untuk menggunakan pemutih"
        },
        {
          "id": "B",
          "text": "larangan atau peringatan dalam melakukan prosedur"
        },
        {
          "id": "C",
          "text": "saran untuk mempercepat proses pencucian"
        },
        {
          "id": "D",
          "text": "penjelasan mengenai jenis-jenis serat kain"
        },
        {
          "id": "E",
          "text": "langkah pertama dalam mencuci pakaian"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-21",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Teks prosedur tentang Cara Menggunakan Alat Pemadam Api Ringan (APAR) termasuk jenis teks prosedur ....",
      "options": [
        {
          "id": "A",
          "text": "membuat sesuatu"
        },
        {
          "id": "B",
          "text": "melakukan suatu pekerjaan/aktivitas"
        },
        {
          "id": "C",
          "text": "memainkan alat musik"
        },
        {
          "id": "D",
          "text": "mengoperasikan suatu alat"
        },
        {
          "id": "E",
          "text": "membudidayakan tanaman"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-22",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Penggunaan kata ganti orang (pronomina) dalam teks prosedur umumnya bersifat umum, seperti ....",
      "options": [
        {
          "id": "A",
          "text": "aku, saya, kami"
        },
        {
          "id": "B",
          "text": "dia, ia, mereka"
        },
        {
          "id": "C",
          "text": "Anda, kita, pengguna"
        },
        {
          "id": "D",
          "text": "beliau, saudara, tuan"
        },
        {
          "id": "E",
          "text": "ini, itu, tersebut"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-23",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! Setelah kartu ATM dimasukkan, pilihlah bahasa yang ingin Anda gunakan. Partisipan manusia yang terdapat dalam kalimat tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "kartu ATM"
        },
        {
          "id": "B",
          "text": "bahasa"
        },
        {
          "id": "C",
          "text": "masukkan"
        },
        {
          "id": "D",
          "text": "Anda"
        },
        {
          "id": "E",
          "text": "pilihlah"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-24",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perbaikan yang tepat untuk kalimat tidak efektif: Para hadirin sekalian dimohon untuk segera duduk di kursi yang telah disediakan agar sesuai kaidah teks prosedur formal adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Hadirin dimohon segera duduk di kursi yang telah disediakan."
        },
        {
          "id": "B",
          "text": "Para hadirin dimohon untuk segera duduk di kursi."
        },
        {
          "id": "C",
          "text": "Hadirin sekalian dimohon segera duduk."
        },
        {
          "id": "D",
          "text": "Dimohon para hadirin sekalian duduk di kursi yang disediakan."
        },
        {
          "id": "E",
          "text": "Semua para hadirin dimohon duduk di kursi."
        }
      ],
      "correctOptionId": "A",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-25",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Teks yang menjelaskan proses terjadinya atau terbentuknya suatu fenomena alam maupun sosial disebut teks ....",
      "options": [
        {
          "id": "A",
          "text": "prosedur"
        },
        {
          "id": "B",
          "text": "eksposisi"
        },
        {
          "id": "C",
          "text": "eksplanasi"
        },
        {
          "id": "D",
          "text": "deskripsi"
        },
        {
          "id": "E",
          "text": "persuasi"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-26",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Struktur teks eksplanasi secara berurutan adalah ....",
      "options": [
        {
          "id": "A",
          "text": "pernyataan umum - deretan penjelas - interpretasi"
        },
        {
          "id": "B",
          "text": "tujuan - alat dan bahan - langkah-langkah"
        },
        {
          "id": "C",
          "text": "tesis - argumentasi - penegasan ulang"
        },
        {
          "id": "D",
          "text": "orientasi - komplikasi - resolusi"
        },
        {
          "id": "E",
          "text": "identifikasi - deskripsi bagian - simpulan"
        }
      ],
      "correctOptionId": "A",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-27",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bagian teks eksplanasi yang berisi gambaran awal atau definisi umum tentang fenomena yang akan dibahas adalah ....",
      "options": [
        {
          "id": "A",
          "text": "deretan penjelas"
        },
        {
          "id": "B",
          "text": "interpretasi"
        },
        {
          "id": "C",
          "text": "pernyataan umum"
        },
        {
          "id": "D",
          "text": "kausalitas"
        },
        {
          "id": "E",
          "text": "kronologis"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-28",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Inti dari teks eksplanasi yang memaparkan urutan sebab-akibat atau proses terjadinya suatu peristiwa terdapat pada bagian ....",
      "options": [
        {
          "id": "A",
          "text": "pernyataan umum"
        },
        {
          "id": "B",
          "text": "deretan penjelas"
        },
        {
          "id": "C",
          "text": "interpretasi"
        },
        {
          "id": "D",
          "text": "abstraksi"
        },
        {
          "id": "E",
          "text": "orientasi"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578928-29",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bagian akhir teks eksplanasi yang berisi intisari atau pandangan penulis terhadap fenomena yang dijelaskan disebut ....",
      "options": [
        {
          "id": "A",
          "text": "pernyataan umum"
        },
        {
          "id": "B",
          "text": "deretan penjelas"
        },
        {
          "id": "C",
          "text": "interpretasi"
        },
        {
          "id": "D",
          "text": "evaluasi"
        },
        {
          "id": "E",
          "text": "rekomendasi"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-30",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah paragraf berikut! Gempa bumi adalah getaran atau guncangan yang terjadi di permukaan bumi akibat pelepasan energi dari dalam secara tiba-tiba yang menciptakan gelombang seismik. Paragraf tersebut termasuk bagian ....",
      "options": [
        {
          "id": "A",
          "text": "deretan penjelas"
        },
        {
          "id": "B",
          "text": "interpretasi"
        },
        {
          "id": "C",
          "text": "pernyataan umum"
        },
        {
          "id": "D",
          "text": "argumentasi"
        },
        {
          "id": "E",
          "text": "penutup"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-31",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Berikut ini yang BUKAN merupakan contoh topik teks eksplanasi fenomena sosial adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Terjadinya Kemacetan di Kota Besar"
        },
        {
          "id": "B",
          "text": "Proses Terbentuknya Pelangi"
        },
        {
          "id": "C",
          "text": "Penyebab Tingginya Angka Pengangguran"
        },
        {
          "id": "D",
          "text": "Dampak Urbanisasi terhadap Kesenjangan Sosial"
        },
        {
          "id": "E",
          "text": "Fenomena Demonstrasi Mahasiswa"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-32",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Kaidah kebahasaan teks eksplanasi yang dominan digunakan untuk menjelaskan hubungan sebab-akibat adalah konjungsi ....",
      "options": [
        {
          "id": "A",
          "text": "temporal"
        },
        {
          "id": "B",
          "text": "kausalitas"
        },
        {
          "id": "C",
          "text": "kronologis"
        },
        {
          "id": "D",
          "text": "pertentangan"
        },
        {
          "id": "E",
          "text": "perbandingan"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-33",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Manakah kelompok konjungsi kausalitas yang tepat di bawah ini?",
      "options": [
        {
          "id": "A",
          "text": "kemudian, lalu, setelah itu"
        },
        {
          "id": "B",
          "text": "sebab, karena, sehingga, akibatnya"
        },
        {
          "id": "C",
          "text": "dan, serta, lagipula"
        },
        {
          "id": "D",
          "text": "tetapi, namun, melainkan"
        },
        {
          "id": "E",
          "text": "jika, apabila, asalkan"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-34",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kalimat berikut! Hujan asam terjadi karena tingginya kadar sulfur dioksida dan nitrogen oksida di atmosfer yang bereaksi dengan uap air. Konjungsi yang menunjukkan hubungan sebab-akibat pada kalimat tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "dan"
        },
        {
          "id": "B",
          "text": "yang"
        },
        {
          "id": "C",
          "text": "dengan"
        },
        {
          "id": "D",
          "text": "karena"
        },
        {
          "id": "E",
          "text": "di"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-35",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Dalam teks eksplanasi, penulis menggunakan kata kerja pasif. Contoh kata kerja pasif yang tepat adalah ....",
      "options": [
        {
          "id": "A",
          "text": "membentuk, mengalirkan, menyebabkan"
        },
        {
          "id": "B",
          "text": "terbentuk, dialirkan, disebabkan"
        },
        {
          "id": "C",
          "text": "berproses, bergerak, berjalan"
        },
        {
          "id": "D",
          "text": "terjadinya, prosesnya, dampaknya"
        },
        {
          "id": "E",
          "text": "memicu, mendorong, menghambat"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-36",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! Banjir bandang tidak hanya disebabkan oleh faktor alam seperti curah hujan tinggi, tetapi juga akibat ulah manusia yang menebang hutan secara liar. Pola pengembangan paragraf eksplanasi tersebut adalah pola ....",
      "options": [
        {
          "id": "A",
          "text": "kronologis"
        },
        {
          "id": "B",
          "text": "kausalitas"
        },
        {
          "id": "C",
          "text": "spasial"
        },
        {
          "id": "D",
          "text": "definisi"
        },
        {
          "id": "E",
          "text": "ilustrasi"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-37",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Teks eksplanasi bersifat informatif dan faktual, artinya ....",
      "options": [
        {
          "id": "A",
          "text": "berisi pendapat pribadi penulis yang bersifat subjektif"
        },
        {
          "id": "B",
          "text": "berdasarkan fakta dan realitas yang dapat dibuktikan secara ilmiah"
        },
        {
          "id": "C",
          "text": "bertujuan memengaruhi pembaca agar mengikuti keinginan penulis"
        },
        {
          "id": "D",
          "text": "menceritakan kisah khayalan atau fiksi"
        },
        {
          "id": "E",
          "text": "berisi langkah-langkah melakukan sesuatu"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-38",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kata-kata berikut: seismik, tektonik, vulkanik, episentrum, magnitudo. Kata-kata tersebut merupakan istilah teknis dalam bidang ....",
      "options": [
        {
          "id": "A",
          "text": "ekonomi"
        },
        {
          "id": "B",
          "text": "sosiologi"
        },
        {
          "id": "C",
          "text": "geologi"
        },
        {
          "id": "D",
          "text": "biologi"
        },
        {
          "id": "E",
          "text": "astronomi"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-39",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan teks eksplanasi berikut! Dengan demikian, pelestarian lingkungan menjadi kunci utama untuk meminimalisasi risiko bencana tanah longsor di masa mendatang. Kutipan tersebut merupakan bagian ....",
      "options": [
        {
          "id": "A",
          "text": "pernyataan umum"
        },
        {
          "id": "B",
          "text": "deretan penjelas"
        },
        {
          "id": "C",
          "text": "interpretasi"
        },
        {
          "id": "D",
          "text": "identifikasi fenomena"
        },
        {
          "id": "E",
          "text": "rangkaian kejadian"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-40",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Pola pengembangan paragraf eksplanasi yang disusun berdasarkan urutan waktu terjadinya peristiwa disebut pola ....",
      "options": [
        {
          "id": "A",
          "text": "kausalitas"
        },
        {
          "id": "B",
          "text": "kronologis"
        },
        {
          "id": "C",
          "text": "deduktif"
        },
        {
          "id": "D",
          "text": "induktif"
        },
        {
          "id": "E",
          "text": "perbandingan"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-41",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Cermati kalimat berikut! Proses penguapan air laut terjadi akibat pemanasan sinar matahari, lalu uap air tersebut naik ke atmosfer dan mengalami kondensasi. Kata lalu pada kalimat tersebut berfungsi sebagai konjungsi ....",
      "options": [
        {
          "id": "A",
          "text": "kausalitas"
        },
        {
          "id": "B",
          "text": "syarat"
        },
        {
          "id": "C",
          "text": "tujuan"
        },
        {
          "id": "D",
          "text": "kronologis/temporal"
        },
        {
          "id": "E",
          "text": "perbandingan"
        }
      ],
      "correctOptionId": "D",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-42",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Fokus utama pembahasan dalam teks eksplanasi adalah pada ....",
      "options": [
        {
          "id": "A",
          "text": "tokoh dan penokohan"
        },
        {
          "id": "B",
          "text": "cara atau langkah membuat sesuatu"
        },
        {
          "id": "C",
          "text": "proses mengapa dan bagaimana suatu fenomena terjadi"
        },
        {
          "id": "D",
          "text": "kelebihan dan kekurangan suatu karya"
        },
        {
          "id": "E",
          "text": "argumen untuk menolak suatu pendapat"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-43",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! Kemiskinan merupakan salah satu masalah sosial yang kompleks. Kondisi ini dipicu oleh rendahnya tingkat pendidikan, terbatasnya lapangan pekerjaan, serta ketimpangan distribusi pendapatan. Fakta yang terdapat dalam kutipan tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Kemiskinan adalah masalah yang paling mudah diatasi."
        },
        {
          "id": "B",
          "text": "Pemerintah tidak peduli terhadap masalah kemiskinan."
        },
        {
          "id": "C",
          "text": "Kemiskinan dipicu oleh rendahnya pendidikan dan terbatasnya lapangan kerja."
        },
        {
          "id": "D",
          "text": "Masyarakat miskin tidak mau berusaha mencari pekerjaan."
        },
        {
          "id": "E",
          "text": "Kemiskinan hanya terjadi di wilayah pedesaan."
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-44",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Penggunaan kata benda (nomina) yang merujuk pada jenis fenomena, bukan pada partisipan manusia, merupakan salah satu ciri teks eksplanasi. Contohnya adalah ....",
      "options": [
        {
          "id": "A",
          "text": "siswa, guru, kepala sekolah"
        },
        {
          "id": "B",
          "text": "pelangi, gerhana, tsunami"
        },
        {
          "id": "C",
          "text": "petani, nelayan, pedagang"
        },
        {
          "id": "D",
          "text": "dokter, perawat, pasien"
        },
        {
          "id": "E",
          "text": "penulis, pembaca, penyunting"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-45",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perhatikan kalimat berikut! Gerhana matahari total terjadi ketika posisi bulan terletak di antara bumi dan matahari sehingga menutup sebagian atau seluruh cahaya matahari. Pertanyaan yang jawabannya terdapat pada kalimat tersebut adalah ....",
      "options": [
        {
          "id": "A",
          "text": "Kapan gerhana matahari total akan terjadi lagi?"
        },
        {
          "id": "B",
          "text": "Mengapa bulan berputar mengelilingi bumi?"
        },
        {
          "id": "C",
          "text": "Bagaimana proses terjadinya gerhana matahari total?"
        },
        {
          "id": "D",
          "text": "Di mana wilayah yang dapat melihat gerhana matahari?"
        },
        {
          "id": "E",
          "text": "Berapa lama durasi gerhana matahari total?"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-46",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Perbedaan mendasar antara teks prosedur dan teks eksplanasi terletak pada ....",
      "options": [
        {
          "id": "A",
          "text": "penggunaan bahasa Indonesia yang baku"
        },
        {
          "id": "B",
          "text": "penggunaan konjungsi temporal"
        },
        {
          "id": "C",
          "text": "tujuan teks: teks prosedur memandu cara melakukan sesuatu, sedangkan teks eksplanasi menjelaskan proses terjadinya fenomena"
        },
        {
          "id": "D",
          "text": "panjang pendeknya paragraf dalam teks"
        },
        {
          "id": "E",
          "text": "penggunaan istilah teknis sesuai bidang keilmuan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-47",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Bacalah kutipan berikut! Tsunami berasal dari bahasa Jepang, tsu yang berarti pelabuhan dan nami yang berarti gelombang. Informasi tersebut biasanya diletakkan pada bagian ... dalam teks eksplanasi.",
      "options": [
        {
          "id": "A",
          "text": "deretan penjelas"
        },
        {
          "id": "B",
          "text": "interpretasi"
        },
        {
          "id": "C",
          "text": "pernyataan umum"
        },
        {
          "id": "D",
          "text": "penutup"
        },
        {
          "id": "E",
          "text": "simpulan"
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578929-48",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Manakah pernyataan di bawah ini yang paling tepat sebagai kalimat dalam teks eksplanasi?",
      "options": [
        {
          "id": "A",
          "text": "Sebaiknya masyarakat tidak membuang sampah ke sungai agar tidak banjir."
        },
        {
          "id": "B",
          "text": "Buanglah sampah pada tempatnya demi menjaga kebersihan lingkungan!"
        },
        {
          "id": "C",
          "text": "Sampah yang menumpuk di aliran sungai menghambat laju air sehingga memicu terjadinya banjir."
        },
        {
          "id": "D",
          "text": "Mari kita bergotong royong membersihkan selokan setiap hari Minggu."
        },
        {
          "id": "E",
          "text": "Menurut saya, banjir tahun ini adalah yang paling parah sepanjang sejarah."
        }
      ],
      "correctOptionId": "C",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    },
    {
      "id": "q-imp-1795880578932-49",
      "packageId": "pkg-1795880547658",
      "type": "single_choice",
      "prompt": "Cermati kerangka teks eksplanasi berikut! (1) Pengertian efek rumah kaca (2) Proses terperangkapnya panas matahari oleh gas rumah kaca (3) Dampak pemanasan global akibat efek rumah kaca (4) Simpulan dan pandangan mengenai pentingnya mengurangi emisi karbon Bagian deretan penjelas ditunjukkan oleh nomor ....",
      "options": [
        {
          "id": "A",
          "text": "(1) dan (2)"
        },
        {
          "id": "B",
          "text": "(2) dan (3)"
        },
        {
          "id": "C",
          "text": "(3) dan (4)"
        },
        {
          "id": "D",
          "text": "(1) dan (4)"
        },
        {
          "id": "E",
          "text": "(1), (2), dan (3)"
        }
      ],
      "correctOptionId": "B",
      "points": 2,
      "explanation": "Kunci jawaban sesuai materi pelajaran."
    }
  ]
};
