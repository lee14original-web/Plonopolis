const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = 'data.json';

function loadData() {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// REGISTER
app.post('/register', (req, res) => {
    const { email, login, password } = req.body;

    let users = loadData();

    if (users.find(u => u.login === login)) {
        return res.status(400).json({ error: 'Login zajęty' });
    }

    const newUser = {
        email,
        login,
        password,
        level: 1,
        points: 0,
        fields: 1,
        wallet: 0,
        lastUpdated: Date.now()
    };

    users.push(newUser);
    saveData(users);

    res.json({ success: true });
});

// LOGIN
app.post('/login', (req, res) => {
    const { login, password } = req.body;

    let users = loadData();

    const user = users.find(u => u.login === login && u.password === password);

    if (!user) {
        return res.status(400).json({ error: 'Błędne dane' });
    }

    res.json({ success: true, user });
});

// SAVE
app.post('/save', (req, res) => {
    const { login, data } = req.body;

    let users = loadData();
    let user = users.find(u => u.login === login);

    if (!user) return res.status(404).json({ error: 'Brak użytkownika' });

    if (data.lastUpdated < user.lastUpdated) {
        return res.json({ ignored: true });
    }

    Object.assign(user, data);
    user.lastUpdated = Date.now();

    saveData(users);

    res.json({ success: true });
});

// RANKING
app.get('/ranking', (req, res) => {
    let users = loadData();

    users.sort((a, b) => b.points - a.points);

    const ranking = users.map(u => ({
        login: u.login,
        level: u.level,
        points: u.points,
        fields: u.fields,
        wallet: u.wallet
    }));

    res.json(ranking);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server działa na porcie " + PORT);
});
