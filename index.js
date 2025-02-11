const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ltb0gzh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db('tourVisor').collection('users');
        const storiesCollection = client.db('tourVisor').collection('stories');
        const packagesCollection = client.db('tourVisor').collection('packages');
        const guidesCollection = client.db('tourVisor').collection('guides');
        const wishlistCollection = client.db('tourVisor').collection('wishlist');
        const bookingsCollection = client.db('tourVisor').collection('bookings');

        //jwt related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token });
        })

        // middleware
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            const isAdmin = result?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access!!' })
            }
            next();
        }

        // verify guide middleware
        const verifyGuide = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            const isGuide = result?.role === 'guide';
            if (!isGuide) {
                return res.status(403).send({ message: 'forbidden access!!' })
            }
            next();
        }

        // verify tourist middleware
        const verifyTourist = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            const isTourist = result?.role === 'tourist';
            if (!isTourist) {
                return res.status(403).send({ message: 'forbidden access!!' })
            }
            next();
        }

        // user related
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result);
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const filter = req.query.filter;
            const search = req.query.search;

            let query = {
                email: {$regex: search, $options: 'i'},
            }
            if(filter) query.role = filter
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        app.put('/user', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            // if user already exist
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                if (user.status === 'Requested') {
                    // if existing user tru to change his role
                    const result = await usersCollection.updateOne(query, {
                        $set: { status: user?.status },
                    })
                    return res.send(result);
                } else {
                    // if existing user login again
                    return res.send(isExist);
                }
            }

            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...user,
                    timestamp: Date.now(),
                },
            }
            const result = await usersCollection.updateOne(query, updateDoc, options);
            res.send(result);
        })

        //update a user role
        app.patch('/users/update/:email',verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email }
            const updateDoc = {
                $set: { ...user, timestamp: Date.now() },
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // stories related
        app.post('/stories', verifyToken, verifyTourist, async (req, res) => {
            const story = req.body;
            const result = await storiesCollection.insertOne(story);
            res.send(result);
        })

        app.get('/stories', async (req, res) => {
            const result = await storiesCollection.find().toArray();
            res.send(result);
        })

        app.get('/stories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await storiesCollection.findOne(query);
            res.send(result);
        })

        // package related
        app.post('/package', verifyToken, verifyAdmin, async (req, res) => {
            const package = req.body;
            const result = await packagesCollection.insertOne(package);
            res.send(result);
        })

        app.get('/packages', async (req, res) => {
            const result = await packagesCollection.find().toArray();
            res.send(result);
        })

        app.get('/packages/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await packagesCollection.findOne(query);
            res.send(result);
        })

        // tour guides
        app.post('/guides', verifyToken,verifyGuide, async (req, res) => {
            const guide = req.body;

            const query = {
                email: guide.email,
            }
            const alreadySubmitted = await guidesCollection.findOne(query);
            if (alreadySubmitted) {
                return res.status(400).send({ message: 'Already Submitted' });
            }

            const result = await guidesCollection.insertOne(guide);
            res.send(result);
        })

        app.get('/guides', async (req, res) => {
            const result = await guidesCollection.find().toArray();
            res.send(result);
        })

        app.get('/guides/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await guidesCollection.findOne(query);
            res.send(result);
        })

        // wishlist related
        app.post('/wishlists',verifyToken,verifyTourist, async (req, res) => {
            const package = req.body;
            const result = await wishlistCollection.insertOne(package);
            res.send(result);
        })

        app.get('/wishlists', verifyToken,verifyTourist, async (req, res) => {
            const email = req.query.email;
            const result = await wishlistCollection.find({ email }).toArray();
            res.send(result);
        })

        app.delete('/wishlists/:id', verifyToken,verifyTourist, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await wishlistCollection.deleteOne(query);
            res.send(result);
        })

        // booking relate
        app.post('/bookings', verifyToken,verifyTourist, async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/bookings', verifyToken,verifyTourist, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/bookings/:name',verifyToken,verifyGuide, async (req, res) => {
            const guideName = req.params.name;
            const query = { tourGuide: guideName }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        app.patch('/bookings/update/:id',verifyToken,verifyGuide, async (req, res) => {
            const id = req.params.id;
            const booking = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { 
                    status: booking.status,
                },
            }
            const result = await bookingsCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', verifyToken,verifyTourist, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('tour visor!')
})

app.listen(port, () => {
    console.log(`tour visor is running on ${port}`);
})