import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
env.config();
const port = 3000;
const db = new pg.Client({
  user: process.env.DB_USERNAME,
  host: "localhost",
  database: "world",
  password: process.env.DB_PASSWORD,
  port: 5432,
});
let currentUserId = 1;
let currentColor;
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


let users = [];

async function getCurrentUser() {
  const result = await db.query('SELECT * FROM users');
  users = result.rows.sort((a, b) => a.id - b.id);
  return users.find((user) => user.id == currentUserId);
}

async function checkVisisted() {
  const result = await db.query(
    "SELECT visited_countries.country_code, users.name, users.color FROM visited_countries JOIN users ON users.id = visited_countries.user_id WHERE users.id = $1"
  , [currentUserId]);

  let countries = result.rows.map((item) => item.country_code);
  return countries;
}

app.get("/", async (req, res) => {
  const currentUser = await getCurrentUser()
  const countries = await checkVisisted();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      const result = await db.query(`SELECT country_code FROM visited_countries WHERE user_id = ${currentUserId}`);
      let currentUserCountries = result.rows.map((item) => item.country_code);

      // Check if country already exists in user's visited countries
      if(currentUserCountries.includes(countryCode)){
        const currentUser = await getCurrentUser()
        const countries = await checkVisisted();
        res.render("index.ejs", {
          countries: countries,
          total: countries.length,
          users: users,
          color: currentUser.color,
          error: "You've already added this country. try again"
        });
      // If country doesn't exists in user's list, add to visited_countries
      } else {
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUserId]
        );
        res.redirect("/");
      }
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
    const currentUser = await getCurrentUser()
    const countries = await checkVisisted();
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      error: "Country does not exist. try again"
    });
  }
});

app.post("/user", async (req, res) => {
  if(req.body.user){
    currentUserId = req.body.user;
    res.redirect('/');
  }
  if(req.body.add){
    res.render('new.ejs');
  }
});

app.post("/new", async (req, res) => {
  const newUserName = req.body.name;
  const newUserColor = req.body.color;
  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *;",
      [newUserName, newUserColor]
    );
    currentUserId = result.rows[0].id;
    res.redirect('/');
  } catch(err) {
    console.error('Error occured while inserting new user\n', err.stack);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
