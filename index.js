const express = require('express')
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { default: mongoose } = require('mongoose');
const ObjectId = require('mongodb').ObjectId
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())


// database 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dejzn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.set("strictQuery", false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(uri)
        console.log(`MongoDB connected:  ${conn.connection.host}`);
    } catch (error) {
        console.log(error);
        process.exit(1)
    }
}




async function run() {
    try {
        await client.connect()
        const carCollection = client.db('modernCarDb').collection('products')
        const orderCollection = client.db('modernCarDb').collection('orders')
        const userCollection = client.db('modernCarDb').collection('users')
        const ratingCollection = client.db('modernCarDb').collection('ratings')

        // get all products from db
        app.get('/products', async (req, res) => {
            const page = req.query.page;
            const size = parseInt(req.query.size);
            let result;
            const count = await carCollection.find({}).count()
            if (page) {
                result = await carCollection.find({}).skip(page * size).limit(size).toArray();
            } else {
                result = await carCollection.find().toArray()
            }

            res.json({
                count,
                result
            })
        })
        // get single product
        app.get('/products/:id', async (req, res) => {
            const result = await carCollection.findOne({ _id: ObjectId(req.params.id) })
            res.json(result)
        })
        //add a new product to db
        app.post('/products', async (req, res) => {
            const result = await carCollection.insertOne(req.body)
            res.json(result)
        })
        // delete product from db
        app.delete('/delete/:id', async (req, res) => {
            const result = await carCollection.deleteOne({ _id: ObjectId(req.params.id) })
            res.json(result)
        })
        //place order
        app.post('/orders', async (req, res) => {
            const result = await orderCollection.insertOne(req.body)
            res.json(result)
        })
        // get single email ordered product
        app.get('/orders', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await orderCollection.find(query).toArray()
            res.json(result)
        })
        // get all orders
        app.get('/all-orders', async (req, res) => {
            const result = await orderCollection.find().toArray()
            res.json(result)
        })
        app.delete('/delete-order/:id', async (req, res) => {
            const result = await orderCollection.deleteOne({ _id: ObjectId(req.params.id) })
            res.json(result)
        })
        // get single order for payment
        app.get('/payment/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.findOne(query)
            res.json(result)
        })
        // update order after payment successfull
        app.put('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    payment: payment
                }
            }
            const result = await orderCollection.updateOne(filter, updateDoc)
            res.json(result)
        })

        // update orders status
        app.put('/updateStatus/:id', async (req, res) => {
            const id = req.params.id
            const result = await orderCollection.updateOne({ _id: ObjectId(id) }, {
                $set: {
                    status: 'Approved',
                }
            })
            res.json(result);
        })
        app.put('/updateStatus1/:id', async (req, res) => {
            const id = req.params.id
            const result = await orderCollection.updateOne({ _id: ObjectId(id) }, {
                $set: {
                    status: 'on the way',
                }
            })
            res.json(result);
        })

        // add user to db
        app.post('/users', async (req, res) => {
            const result = await userCollection.insertOne(req.body)
            res.json(result)
        })
        // upsert for google sign in
        app.put('/users', async (req, res) => {
            const user = req.body
            const filter = { email: user.email }
            const options = { upsert: true }
            const updateDoc = { $set: user }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        })
        // make admin role 
        app.put('/users/admin', async (req, res) => {
            const user = req.body
            const filter = { email: user.email }
            const updateDoc = { $set: { role: 'admin' } }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.json(result)
        })
        //get admin user 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let isAdmin = false
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })
        })

        // add rating to db
        app.post('/rating', async (req, res) => {
            const result = await ratingCollection.insertOne(req.body)
            res.json(result)
        })
        app.get('/rating', async (req, res) => {
            const result = await ratingCollection.find().toArray()
            res.json(result)
        })

        // payment method setup
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body
            const amount = paymentInfo.price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            })
            res.json({ clientSecret: paymentIntent.client_secret })
        })

    } finally {
        // await client.close()
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('MCH server is running.')
})

connectDB().then(() => {
    app.listen(port, () => {
        console.log('Port running at', port)
    })
})