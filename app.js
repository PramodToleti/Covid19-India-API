const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (err) {
    console.log(`DB ERROR: ${err.message}`);
    process.exit(-1);
  }
};

initializeDBAndServer();

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `
    SELECT 
      *
    FROM 
      user
    WHERE 
      username = '${username}';
  `;
  const dbResponse = await db.get(checkUserQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isCorrectPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//User Authentication
const authorizationToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.send(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (err, payload) => {
      if (err) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
