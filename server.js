const WebSocket = require("ws");
const express = require("express");
const path = require("path");
const cors = require('cors');
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const crypto = require('crypto');
require('dotenv').config(); // Load .env variables
// const multer = require("multer");
// const upload = multer({ dest: "uploads/" }); // You can later use cloud storage if needed

const cloudinary = require('cloudinary').v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer + Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_pictures', // Optional Cloudinary folder name
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 300, height: 300, crop: 'limit' }],
  },
});

const upload = multer({ storage: storage });

// Storage for poster images
const exerciseStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'exercise_posters',
    allowed_formats: ['jpg', 'png'],
    transformation: [{ width: 300, height: 300, crop: 'limit' }]
  },
});
const exerciseUpload = multer({ storage: exerciseStorage });


const connectionString = process.env.DATABASE_URL;
const passwordResetTokens = new Map(); // In-memory store for demo. Use DB for production.


const app = express();


const pool = new Pool({
    connectionString: process.env.DATABASE_URL ,
    ssl: {
      rejectUnauthorized: false,
    },
  
  });



  app.use(cors({
    // origin: 'https://calicareapp.onrender.com', // Your frontend domain
    origin: 'https://calicareapp.up.railway.app', // Your frontend domain
    credentials: true                            // Allow cookies to be sent
  }));
  

  //-------solution for CORS error
  app.set("trust proxy", 1); // trust first proxy
app.use(session({
    store: new PgSession({
      pool: pool,                // your pg `Pool` instance
      tableName: 'session',      // you can name this whatever you like
      createTableIfMissing: true // auto-create the table on startup
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // secure: process.env.NODE_ENV === 'production',
      // maxAge: 2 * 60 * 60 * 1000 // 2 hours

      // ------- for local testing
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000

      //-------- for hosting 
      // secure: true,          // ✅ Must be true for HTTPS
      // sameSite: 'none',      // ✅ Required for cross-origin cookies
      // maxAge: 2 * 60 * 60 * 1000 // 2 hours
    }
  }));

const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });


// const { Pool } = require('pg');
console.log('🔗 Connecting to Postgres with:', {
    host:   process.env.DB_HOST,
    port:   process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:   process.env.DB_USER,
    databaseurl: process.env.DATABASE_URL,
  });


const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS },
});


app.use(express.json());

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS)
app.use(express.static('public'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Route for login page
app.get('/login', (req, res) => {
  // console.log("✅ Login success:", result.rows[0]);
    res.sendFile(path.join(__dirname, 'login.html'));
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Shortcut for hardcoded admin
    if (email === "admin@jkthub.com" && password === "Admin123") {
      req.session.user = {
        email,
        role: "admin",
      };
      return res.redirect("/Admin/admin.html");
    }

    // Query database for user
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    // If no user found
    if (result.rows.length === 0) {
      return res.send("Invalid credentials");
      // res.render('Admin/admin.html', { error: 'Invalid credentials' });
      // res.render('login.html', { error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Save to session
    req.session.user = user;

    // Redirect based on role
    if (user.role === "admin") {
      return res.redirect("/Admin/admin.html");
    } else if (user.role === "user") {
      return res.redirect("/dashboard");
    }
    else if (user.role === "ticketer") {
      return res.redirect("/ticketer");
    }
    else if (user.role === "monitor") {
      return res.redirect("/monitor");
    }
    else {
      return res.send("Unknown user role.");
    }

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error during login.");
  }
});

// Route for signup page

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup2.html'));
});

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
});

app.get('/splash', (req, res) => {
  res.sendFile(path.join(__dirname, 'splash.html'));
});


app.get("/dashboard", (req, res) => {
    // if (!req.session.user) return res.redirect("/login.html");
    res.sendFile(path.join(__dirname, "index2.html"));
    // res.render("dashboard", { user: req.session.user });
});
  
app.get("/ticketer", (req, res) => {
  // if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "ticketer.html"));
  // res.render("dashboard", { user: req.session.user });
});

app.get("/monitor", (req, res) => {
  // if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "monitor.html"));
  // res.render("dashboard", { user: req.session.user });
});

// (Optional) Redirect root URL to login
app.get('/', (req, res) => {
    // res.redirect('/login');
    // res.redirect('/welcome');
    res.redirect('/splash');
});

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    res.status(403).send('Forbidden');
  }
}


app.get("/admin", (req, res) => {
  if (req.session.user && req.session.user.role === "admin") {
    res.sendFile(__dirname + "Admin/admin.html");
  } else {
    res.redirect("/");
  }
});

// Get all users
app.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, gender, profile_picture, tag FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Delete a user
app.delete('/admin/users/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update user details (role, name, email)
app.put("/admin/users/:id", isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { username, email, role, tag } = req.body;

  try {
    await pool.query(
      "UPDATE users SET username = $1, email = $2, role = $3, tag = $4 WHERE id = $5",
      [username, email, role, tag, userId]
      // "UPDATE users SET role = $3 WHERE id = $1", 
      // [username, email, role, userId]
    );
    res.status(200).send("User updated");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating user");
  }
});

app.get("/getUserDeviceData", async (req, res) => {
  const { email } = req.query;
  const result = await pool.query(
    "SELECT * FROM nodemcu2_data WHERE email = $1 ORDER BY date DESC, time DESC",
    [email]
  );
  res.json(result.rows);
});


app.get("/getUserData", async (req, res) => {
    const { device_ip } = req.query;
    const userId = req.session.user.id;
    const data = await pool.query("SELECT * FROM nodemcu_data WHERE user_id = $1 AND device_ip = $2", [userId, device_ip]);
    res.json(data.rows);
});

//------getting tag details--------------------------
app.get('/tag-details', async (req, res) => {
  const { tag } = req.query;
  const tagResult = await pool.query("SELECT * FROM users WHERE tag = $1", [tag]);
  if (tagResult.rows.length === 0) return res.send("No account with that email found.");
  res.json(tagResult);
});

  // app.get("/getProfile", async (req, res) => {
  //   if (!req.session.user) return res.status(401).send("Not logged in");
  //   console.log("🔍 Session user:", req.session.user);
  //   const userId = req.session.user.id;
  //   const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  //   res.json(result.rows[0]);
  // });

  app.get("/getProfile", async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).send("Not logged in");
      }
  
      console.log("🔍 Session user:", req.session.user);
      const userId = req.session.user.id;
  
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  
      if (result.rows.length === 0) {
        return res.status(404).send("User not found");
      }
  
      res.json(result.rows[0]);
    } catch (error) {
      console.error("❌ Error in /getProfile:", error);
      res.status(500).send("Server error");
    }
  });
  
 
  app.get("/profile", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    res.sendFile(path.join(__dirname, "profile.html"));
  });

  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });
  
  
  app.post("/signup", upload.single("profile_picture"), async (req, res) => {
    
    const { email, username, phone, gender, password, tag, role } = req.body;
    console.log("📸 Uploaded File:", req.file); // <- log this
    // this code below that will store the file in the uploads folder to the database
    // const profile_picture = req.file ? req.file.filename : null;

    //this code below that will store the file in the cloudinary to the database
    const profile_picture = req.file ? req.file.path : null;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // const role = "user"; // Default role for new users
    const created_at = Date.now();
    console.log("📷 Filename to save in DB:", profile_picture);
    
    await pool.query(`
      INSERT INTO pending_users (email, username, phone, gender, password, otp, profile_picture, role, tag)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      
    `, [email, username, phone, gender, password, otp, profile_picture, role, tag]);
  
    await transporter.sendMail({
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });
  
    res.sendStatus(200);
  });
  

app.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    const result = await pool.query("SELECT * FROM pending_users WHERE email = $1 AND otp = $2", [email, otp]);
  
    if (result.rows.length === 0) return res.send("Invalid OTP");
  
  const user = result.rows[0];
  const created_at = Date.now();
    // await pool.query("INSERT INTO users (email, username, phone, gender, password, profile_picture) VALUES ($1, $2, $3, $4, $5)", 
    //   [user.email, user.username, user.phone, user.gender, user.password]);
  
    await pool.query(
      "INSERT INTO users (email, username, phone, gender, password, profile_picture, role, tag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", 
      [user.email, user.username, user.phone, user.gender, user.password, user.profile_picture, user.role, user.tag]
    );    
    
    await pool.query("DELETE FROM pending_users WHERE email = $1", [email]);
    console.log("✅ User added to users table:", user.email);
    res.send("Verification successful. You can now login.");
    // alert("Verification successful. You can now login.");
    // res.redirect("/login");
  });


  // Update profile route
app.post('/updateProfile', upload.single('profile_picture'), async (req, res) => {
    const { username, email, phone, gender, password } = req.body;
    const userId = req.session.user.id;

    // If a new profile picture is uploaded, get the URL from Cloudinary
    let profile_picture_url = req.file ? req.file.path : null;

    try {
        // Update the user profile in the database
        const query = `
            UPDATE users 
            SET 
                username = $1, 
                email = $2, 
                phone = $3, 
                gender = $4, 
                password = $5, 
                profile_picture = $6
            WHERE id = $7
            RETURNING *;
        `;

        const result = await pool.query(query, [username, email, phone, gender, password, profile_picture_url, userId]);

      
        if (result.rows.length === 0) {
            return res.status(404).send('User not found');
        }

        // Update session with new user data (if necessary)
        req.session.user = result.rows[0];

        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0],
        });
    } catch (error) {
        console.error("❌ Error updating profile:", error);
        res.status(500).send('Server error');
    }
});


  
  app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'forgot-password.html'));
  });


  
  // Handle forgot password form
  app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.send("No account with that email found.");
  
    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
  
    // Save token and expiry
    passwordResetTokens.set(token, { email, expires });
  
    const resetLink = `http://${req.headers.host}/reset-password/${token}`;
    // const resetLink = `https://calicareapp.onrender.com//reset-password/${token}`;
    
  
    await transporter.sendMail({
      to: email,
      subject: "Password Reset",
      text: `Click the link to reset your password: ${resetLink}`,
    });
  
    res.send("Reset link sent to your email.");
  });

  app.get('/reset-password/:token', (req, res) => {
    const tokenData = passwordResetTokens.get(req.params.token);
  
    if (!tokenData || tokenData.expires < Date.now()) {
      return res.send("Reset token is invalid or has expired.");
    }
  
    // You can dynamically render the form with the token
    // res.send(`
    //   <form action="/reset-password/${req.params.token}" method="POST">
    //     <input type="text" name="password" placeholder="Enter new password" required />
    //     <button type="submit">Reset Password</button>
    //   </form>
    // `);

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Reset Password</title>
          <style>
            body {
              font-family: "Segoe UI", sans-serif;
              background-color: #f0f2f5;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
        
            .container {
              background: #fff;
              padding: 40px 30px;
              border-radius: 10px;
              box-shadow: 0 8px 20px rgba(0,0,0,0.1);
              text-align: center;
              width: 100%;
              max-width: 400px;
            }
        
            h2 {
              margin-bottom: 20px;
              color: #333;
            }
        
            input[type="text"] {
                  width: 100%;
                padding: 10px;
                margin: 10px 0 20px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
        
            button {
              padding: 12px 20px;
              width: 100%;
              background-color: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              transition: background-color 0.3s ease;
            }
        
            button:hover {
              background-color: #1e7e34;
            }
        
            a {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
        
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Set New Password</h2>
            <form action="/reset-password/${req.params.token}" method="POST">
              <input type="text" name="password" placeholder="Enter new password" required />
              <button type="submit">Reset Password</button>
            </form>
            <a href="/login">Back to Login</a>
          </div>
        </body>
        </html>
        `);
        

    
  });
  
  // app.post('/reset-password/:token', async (req, res) => {
  //   const tokenData = passwordResetTokens.get(req.params.token);
  //   if (!tokenData || tokenData.expires < Date.now()) {
  //     return res.send("Reset token is invalid or has expired.");
  //   }
  
   
  //   await pool.query("UPDATE users SET password = $1 WHERE email = $2", [password, tokenData.email]);
  
  //   passwordResetTokens.delete(req.params.token);
  //   res.send("Password successfully updated. You can now <a href='/login'>login</a>.");
// });
  

app.post('/reset-password/:token', async (req, res) => {
  const tokenData = passwordResetTokens.get(req.params.token);

  if (!tokenData || tokenData.expires < Date.now()) {
    return res.send("Reset token is invalid or has expired.");
  }

  const { password } = req.body;

  // Check if user still exists
  const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [tokenData.email]);
  if (userCheck.rows.length === 0) {
    return res.send("User account no longer exists.");
  }

  // Update password
  await pool.query("UPDATE users SET password = $1 WHERE email = $2", [password, tokenData.email]);

  // Clear the token after successful reset
  passwordResetTokens.delete(req.params.token);

  res.send("Password successfully updated. You can now <a href='/login'>login</a>.");
});


// Ensure table exists
async function createTableIfNotExists() {
    const query = `
        CREATE TABLE IF NOT EXISTS nodemcu_table (
            id SERIAL PRIMARY KEY,
            temperature FLOAT NOT NULL,
            humidity FLOAT NOT NULL,
            date DATE NOT NULL,
            time TIME NOT NULL
        );
    `;
    try {
        const client = await pool.connect();
        await client.query(query);
        client.release();
        console.log("Table ensured to exist.");
    } catch (error) {
        console.error("Error creating table:", error);
    }
}
createTableIfNotExists();

// Ensure table exists
// Serve static files
app.use(express.static(path.join(__dirname)));

const clients = new Set();
wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.add(ws);

    ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
    });
});
let nodeMCULastSeen = null;
// Insert data into PostgreSQL
app.post("/postData", express.urlencoded({ extended: true }), async (req, res) => {
    console.log("Received data:", req.body);
    console.log('Inserted into pending_users (or nodemcu_table) for:', /* email or temperature, humidity */);

    const { temperature, humidity } = req.body;
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toISOString().split("T")[1].split(".")[0];

    try {
        const result = await pool.query(
            "INSERT INTO nodemcu_table (temperature, humidity, date, time) VALUES ($1, $2, $3, $4) RETURNING *",
            [temperature, humidity, date, time]
        );

        console.log("Inserted data:", result.rows[0]);
        
        nodeMCULastSeen = now;

        // Notify WebSocket clients
        const newData = JSON.stringify(result.rows[0]);
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(newData);
            }
        });

        res.json({ message: "Data inserted successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({ error: "Database insertion failed" });
    }
    
  nodeMCULastSeen = new Date(); // Update last seen time
  res.send('Data received');

});

app.post("/postData2", express.urlencoded({ extended: true }), async (req, res) => {
  const { temperature, humidity, email, device_id } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toISOString().split("T")[1].split(".")[0];

  try {
    const result = await pool.query(
      `INSERT INTO nodemcu2_data (temperature, humidity, date, time, email, device_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [temperature, humidity, date, time, email, device_id]
    );

    nodeMCULastSeen = new Date();
    res.json({ message: "Data inserted successfully", data: result.rows[0] });
  } catch (err) {
    console.error("Error inserting data:", err);
    res.status(500).json({ error: "Database insertion failed" });
  }
});


// app.get('/nodemcu-status', (req, res) => {
//     if (!nodeMCULastSeen) {
//         return res.json({ online: false, message: 'No data received yet' });
//     }

//     const now = new Date();
//     const diffInSeconds = (now - nodeMCULastSeen) / 1000;

//     if (diffInSeconds < 10) { // if data received in last 10 seconds, consider it online
//         res.json({ online: true, lastSeen: nodeMCULastSeen });
//     } else {
//         res.json({ online: false, lastSeen: nodeMCULastSeen });
//     }
// });


// Retrieve all data in descending order

app.get('/nodemcu-status', (req, res) => {
  if (!nodeMCULastSeen) {
    return res.json({ online: false, message: 'No data received yet' });
  }

  const now = new Date();
  const diffInSeconds = (now - nodeMCULastSeen) / 1000;

  const isOnline = diffInSeconds < 10; // 10s threshold
  res.json({
    online: isOnline,
    lastSeen: nodeMCULastSeen,
    message: isOnline ? 'Device is online' : 'Device is offline',
  });
});


app.get("/getAllData", async (req, res) => {
    try {
      // const result = await pool.query("SELECT * FROM nodemcu_table ORDER BY id DESC");
      const result = await pool.query("SELECT * FROM nodemcu2_data ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Database fetch failed" });
    }
});

app.get("/getDataByDate", async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: "Missing start or end date" });
    }

    try {
        const result = await pool.query(
            // "SELECT * FROM nodemcu_table WHERE date BETWEEN $1 AND $2 ORDER BY id DESC",
            `SELECT * FROM nodemcu_table 
             WHERE (date + time) BETWEEN $1::timestamp AND $2::timestamp 
             ORDER BY id DESC`,
            [start, end]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error filtering data:", error);
        res.status(500).json({ error: "Database filter failed" });
    }
});

// Database Table: exercises (id, title, video_url, description, instructor)

app.get('/admin/exercises', async (req, res) => {
  const result = await pool.query('SELECT * FROM exercises ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/admin/exercises', async (req, res) => {
  const { title, video_url, description, instructor, poster_image, category} = req.body;
  await pool.query(
    'INSERT INTO exercises (title, video_url, description, instructor, poster_image, category) VALUES ($1, $2, $3, $4, $6, $7)',
    [title, video_url, description, instructor, poster_image, category]
  );
  res.sendStatus(200);
});

app.put('/admin/exercises/:id', async (req, res) => {
  const { title, video_url, description, instructor, poster_image, category } = req.body;
  await pool.query(
    'UPDATE exercises SET title = $1, video_url = $2, description = $3, instructor = $4, poster_image =$6, category =$7 WHERE id = $5',
    [title, video_url, description, instructor, poster_image, category, req.params.id]
  );
  res.sendStatus(200);
});

app.delete('/admin/exercises/:id', async (req, res) => {
  await pool.query('DELETE FROM exercises WHERE id = $1', [req.params.id]);
  res.sendStatus(200);
});


app.post("/admin/add-exercise", exerciseUpload.single("poster_image"), async (req, res) => {
  const { title, description, instructor, video_url, category } = req.body;
  const poster_image = req.file ? req.file.path : null;

  try {
    await pool.query(`
      INSERT INTO exercises (title, description, instructor, video_url, poster_image, category)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [title, description, instructor, video_url, poster_image, category]);

    res.send("Exercise added successfully.");
  } catch (err) {
    console.error("❌ Error adding exercise:", err);
    res.status(500).send("Error saving exercise.");
  }
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));