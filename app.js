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
    res.status(401);
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

//Get List of States API
app.get("/states/", authorizationToken, async (req, res) => {
  const getStatesQuery = `
        SELECT 
          * 
        FROM 
          state;
    `;

  const dbResponse = await db.all(getStatesQuery);

  const stateDetails = dbResponse.map((obj) => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  });
  res.send(stateDetails);
});

//Get State details API
app.get("/states/:stateId/", authorizationToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateDetailsQuery = `
        SELECT 
          * 
        FROM 
          state 
        WHERE 
          state_id = ${stateId};
    `;

  const dbResponse = await db.get(getStateDetailsQuery);
  const stateDetails = [dbResponse].map((obj) => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  });
  res.send(...stateDetails);
});

//ADD District Details API
app.post("/districts/", authorizationToken, async (req, res) => {
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictDetailsQuery = `
        INSERT INTO 
          district(district_name, state_id, cases, cured, active, deaths)
        VALUES (
              '${districtName}',
               ${stateId},
               ${cases},
               ${cured},
               ${active},
               ${deaths}
        );
    `;
  const dbResponse = await db.run(addDistrictDetailsQuery);
  const districtId = dbResponse.lastID;
  res.send("District Successfully Added");
  //console.log(districtId);
});

//Get District Details API
app.get("/districts/:districtId/", authorizationToken, async (req, res) => {
  const { districtId } = req.params;
  const getDistrictDetailsQuery = `
        SELECT 
          * 
        FROM 
          district
        WHERE 
          district_id = ${districtId};
    `;

  const dbResponse = await db.get(getDistrictDetailsQuery);
  const districtDetails = [dbResponse].map((obj) => {
    return {
      districtId: obj.district_id,
      districtName: obj.district_name,
      stateId: obj.state_id,
      cases: obj.cases,
      cured: obj.cured,
      active: obj.active,
      deaths: obj.deaths,
    };
  });
  res.send(...districtDetails);
});

//Delete district details API
app.delete("/districts/:districtId/", authorizationToken, async (req, res) => {
  const { districtId } = req.params;
  const deleteDistrictDetailsQuery = `
        DELETE FROM 
          district 
        WHERE 
          district_id = ${districtId};
    `;

  const dbResponse = await db.run(deleteDistrictDetailsQuery);
  res.send("District Removed");
});

//Update District Details API
app.put("/districts/:districtId/", authorizationToken, async (req, res) => {
  const { districtId } = req.params;
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const updateDistrictDetailsQuery = `
        UPDATE 
          district
        SET 
          district_name = '${districtName}',
          state_id = ${stateId},
          cases = ${cases},
          cured = ${cured},
          active = ${active},
          deaths = ${deaths}
        WHERE 
          district_id = ${districtId};
    `;

  await db.run(updateDistrictDetailsQuery);
  res.send("District Details Updated");
});

//Get Statistics Details of a State API
app.get("/states/:stateId/stats/", authorizationToken, async (req, res) => {
  const { stateId } = req.params;
  const getStatsOfStateQuery = `
        SELECT 
          SUM(district.cases) AS totalCases,
          SUM(district.cured) AS totalCured,
          SUM(district.active) AS totalActive,
          SUM(district.deaths) AS totalDeaths
        FROM state
            INNER JOIN district
        ON state.state_id = district.state_id
        WHERE 
          district.state_id = ${stateId}
    `;

  const statsDetails = await db.all(getStatsOfStateQuery);
  res.send(...statsDetails);
});

//Get State Name of a District APi
app.get(
  "/districts/:districtId/details/",
  authorizationToken,
  async (req, res) => {
    const { districtId } = req.params;
    const getStateNameQuery = `
        SELECT 
          state.state_name
        FROM district 
          INNER JOIN state 
        ON district.state_id = state.state_id
        WHERE 
          district.district_id = ${districtId};
    `;

    const { state_name } = await db.get(getStateNameQuery);
    res.send({ stateName: state_name });
  }
);
