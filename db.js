const { MongoClient ,ObjectId} = require('mongodb');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

// MongoDB connection string
const uri = 'mongodb://localhost:27017/YesJobs';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('yesjobs'));
app.use(bodyParser.json());

// MongoDB connection
async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error(err);
    }
}
connectDB();
let jobCounter = 100; // Start from 100

// Generate Job ID function
function generateJobId() {
    const jobId = jobCounter; // Format the counter as JOB001, JOB002, ...
    jobCounter++; // Increment the counter for the next job
    return jobId;
}
app.post('/register', async (req, res) => {
    const { username, email, usertype, password } = req.body;

    try {
        let targetCollection;
        if (usertype === 'employer') {
            targetCollection = client.db('YesJobs').collection('Employer');
        } else if (usertype === 'job_seeker') {
            targetCollection = client.db('YesJobs').collection('Job_Seeker');
        } 
        const result = await targetCollection.insertOne({
            username,
            email,
            password
        });

       

        if (result && result.ops && result.ops.length > 0) {
            console.log('Data inserted:', result.ops[0]);
            res.sendFile(__dirname + '/success.html');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error submitting form data');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const db = client.db('YesJobs');
        const jobSeekerCollection = db.collection('Job_Seeker');
        const employerCollection = db.collection('Employer');
        const adminCollection = db.collection('admin');


        // Query the Job_Seeker collection to find a matching user
        const jobSeekerUser = await jobSeekerCollection.findOne({ username });

        if (jobSeekerUser && jobSeekerUser.password === password) {
            res.sendFile(__dirname + '/jobs.html');  
            return;     
        }

        const employerUser = await employerCollection.findOne({ username });

        if (employerUser && employerUser.password === password) {
            res.sendFile(__dirname + '/employer.html');
            return;
        }
        const adminUser = await adminCollection.findOne({ username });

        if (adminUser && adminUser.password === password) {
            res.sendFile(__dirname + '/admin.html');
            return;
        }
        console.log('Invalid username or password');
        res.status(401).send('Invalid username or password');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error during login');
    }
});

app.post('/employer/add-job', async (req, res) => {
    const { companyName, companyAddress, jobTitle, jobDescription, jobType } = req.body;

    try {
        const db = client.db('YesJobs');
        const jobsCollection = db.collection('Jobs');
        const jobId = generateJobId();
        const result = await jobsCollection.insertOne({
            jobId,
            companyName,
            companyAddress,
            jobTitle,
            jobDescription,
            jobType,
            status: 'pending' // Initial status set to "pending"
        });

        if (result.insertedCount > 0) {
            res.status(200).json({ message: 'Job added successfully!' });
        } else {
            res.status(500).json({ message: 'Failed to add job' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding job' });
    }
});

app.get('/view-job-description', async (req, res) => {
    try {
        const jobCollection = client.db('YesJobs').collection('Jobs');
        const approvedJobs = await jobCollection.find({ status: 'approved' }).toArray();

        res.json(approvedJobs);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching approved jobs');
    }
});



app.post('/apply-now', async (req, res) => {
    const { jobId,resumeLink, fullName, phoneNumber, address, date, experience, salary } = req.body;

    try {
        const db = client.db('YesJobs'); // Assuming your database name is "YesJobs"
        const jobApplicationsCollection = db.collection('Application Data'); // Collection name

        const result = await jobApplicationsCollection.insertOne({
            jobId,
            resumeLink,
            fullName,
            phoneNumber,
            address,
            date,
            experience,
            salary
        });
        if (result.insertedCount === 1) {
            res.redirect('/success.html');
            return;
        } else {
            res.status(500).send('Failed to submit application');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error submitting application');
    }
});
// Assuming you have already connected to MongoDB and set up your Express app

app.get('/view-jobs', async (req, res) => {
    try {
        const db = client.db('YesJobs');
        const applicationDataCollection = db.collection('Application Data');
        const allApplications = await applicationDataCollection.find().toArray();

        res.json(allApplications);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching applications');
    }
});

// Route to fetch all jobs for admin view
app.get('/admin/jobs', async (req, res) => {
    try {
        const db = client.db('YesJobs');
        const jobsCollection = db.collection('Jobs');
        const pendingJobs = await jobsCollection.find({ status: 'pending' }).toArray();

        res.json(pendingJobs);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching pending jobs');
    }
});

// Route to approve a job by jobId
app.put('/admin/approve-job/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { status } = req.body;

    try {
        const db = client.db('YesJobs');
        const jobsCollection = db.collection('Jobs');

        const result = await jobsCollection.updateOne(
            { jobId: parseInt(jobId) },
            { $set: { status: 'approved' } }
        );

        if (result.modifiedCount > 0) {
            res.status(200).send('Job status updated successfully');
        } else {
            res.status(404).send('Job not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating job status');
    }
});
app.post('/admin/deny/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        const jobCollection = client.db('YesJobs').collection('Jobs');
        const result = await jobCollection.updateOne(
            { jobId: parseInt(jobId) },
            { $set: { status: 'denied' } }
        );

        if (result.modifiedCount > 0) {
            res.status(200).send('Job denied successfully');
        } else {
            res.status(404).send('Job not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error denying job');
    }
});

//routing each button to the corresponding file 
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.get('/jobs', (req, res) => {
    res.sendFile(__dirname + '/jobs.html');
});
app.get('/contact', (req, res) => {
    res.sendFile(__dirname + '/contact.html');
});
app.get('/services', (req, res) => {
    res.sendFile(__dirname + '/services.html');
});
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});
app.get('/apply-now', (req, res) => {
    res.sendFile(__dirname + '/apply-now.html');
});
app.get('/style', (req, res) => {
    res.sendFile(__dirname + '/style.css');
});
app.get('/employer/add-job', (req, res) => {
    res.sendFile(__dirname + '/add-jobs.html');
});
// Example route to serve view-jobs.html
app.get('/view-jobs.html', (req, res) => {
    res.sendFile(__dirname + '/view-jobs.html'); // Adjust the path as needed
});

app.get('/success', (req, res) => {
    res.sendFile(__dirname + '/success.html'); // Adjust the path as needed
});
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html'); // Adjust the path as needed
});
const port = 8080;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
