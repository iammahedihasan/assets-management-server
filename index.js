const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@rony.exuff.mongodb.net/?retryWrites=true&w=majority&appName=rony`;

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

    //  all collections
    const rolesCollections = client.db('roles').collection('role')
    const assetsCollections = client.db('assets').collection('asset')
    const requestCollections = client.db('requests').collection('request')

    // jwt related apis
    app.post('/jwt', async (req, res) => {
      const user = req.body

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' })
      res.send({ token })
    })

    // middleWare
    const verifyToken = (req, res, next) => {
      console.log(req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' })
      }

      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' })
        }
        req.decoded = decoded
        next()
      })

    }

    // admin middleware
    const verifyManager = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await rolesCollections.findOne(query)

      const manager = user?.role === 'manager'
      if (!manager) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // role based apis
    app.post('/roles', async (req, res) => {
      const userData = req.body
      const query = { email: userData.email }
      const isExits = await rolesCollections.findOne(query)
      if (isExits) {
        return res.send({ message: 'user already exits', insertedId: null })
      }

      const result = await rolesCollections.insertOne(userData)
      res.send(result)
    })

    app.get('/roles/manager/:email', async (req, res) => {
      const email = req.params.email

      const query = { email: email }
      const user = await rolesCollections.findOne(query)
      
      let manager = false
      if (user) {
        manager = user?.role === 'manager'
      }
      res.send({ manager })
    })

    app.get('/payment/manager/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const manager = await rolesCollections.findOne(query)
      res.send(manager)
    })

    app.patch('/payment/manager/:email', async (req, res) => {
      const email = req.params.email
      const paymentData = req.body
      const query = { email: email }
      const updatedDoc = {
        $set: {
          selectedPackage: paymentData.amount,
          transectionId: paymentData.transectionId,
          role: paymentData.role,
          addLimit: paymentData.addLimit
        }
      }
      const result = await rolesCollections.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.patch('/updatePakageLimit/:email',verifyToken,verifyManager, async (req, res) => {
      const email = req.params.email
      const updatePackageData =req.body
      const query = { email: email }
      const updatedDoc = {
        $set: {
          selectedPackage: updatePackageData.selectedPackage
        }
      }
      const result = await rolesCollections.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.get('/hrManager/:email',verifyToken,verifyManager, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await rolesCollections.findOne(query)
      res.send(result)
    })

    app.get('/roles/employee/:email', async (req, res) => {
      const email = req.params.email

      const query = { email: email }
      const user = await rolesCollections.findOne(query)

      let employee = false
      if (user) {
        employee = user?.role === 'employee'
      }
      res.send({ employee })
    })

    

    app.get('/withOutTeam/employees',verifyToken,verifyManager, async (req, res) => {
      const result = await rolesCollections.find({role: 'employee', team: 'none'}).toArray()
      res.send(result)
    })

    app.get('/team/:email',verifyToken,verifyManager, async (req, res) => {
      const email = req.params.email
      const query = { team: email }
      const result = await rolesCollections.find(query).toArray()
      res.send(result)
    })

    app.patch('/addTeam/:id',verifyToken,verifyManager, async (req, res) => {
      const id = req.params.id
      const teamData = req.body
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          team: teamData.team,
          hrManagerId: teamData.hrManagerId
        }
      }
      const result = await rolesCollections.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.patch('/removeTeam/:id',verifyToken,verifyManager, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          team: 'none',
        },
        $unset: {
          hrManagerId: ''
        }
      }
      const result = await rolesCollections.updateOne(query,updatedDoc)
      res.send(result)
    })

    app.get('/myTeam/:id',verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { hrManagerId: id }
      const result = await rolesCollections.find(query).toArray()
      res.send(result)
    })

    app.get('/role/myInfo/:email',verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await rolesCollections.findOne(query)
      res.send(result)
    })


 


    // assets based apis
    app.post('/assets',verifyToken,verifyManager, async (req, res) => {
      const asset = req.body
      const result = await assetsCollections.insertOne(asset)
      res.send(result)
    })

    app.get('/assets/:email',verifyToken,verifyManager, async (req, res) => {
      const { sort } = req.query
      const { available } = req.query
      const { type } = req.query
      const { search } = req.query

      let query = {}
      if (search) {
        query = {
          productName: {
            $regex: search,
            $options: 'i'
          }
        }
        const result = await assetsCollections.find(query).toArray()
        return res.send(result)
      }
      
      if (sort) {
        const result = await assetsCollections.find({email: req.params.email}).sort({ productQuantity: -1 }).toArray()
        return res.send(result)
      }

      if (available) {
        const result = await assetsCollections.find({ email: req.params.email, availability: available }).toArray()
        return res.send(result)
      }

      if (type) {
        const result = await assetsCollections.find({ email: req.params.email, productType: type }).toArray()
        return res.send(result)
      }


      const result = await assetsCollections.find({email: req.params.email}).toArray()
      res.send(result)
    })

    app.delete('/assets/:id',verifyToken,verifyManager, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await assetsCollections.deleteOne(query)
      res.send(result)
    })

    app.get('/assets', verifyToken, async (req, res) => {
      const { available } = req.query
      const { type } = req.query
      const { search } = req.query

      let query = {}
      if (search) {
        query = {
          productName: {
            $regex: search,
            $options: 'i'
          }
        }
        const result = await assetsCollections.find(query).toArray()
        return res.send(result)
      }

      if (available) {
        const query = { availability: available }
        const result = await assetsCollections.find(query).toArray()
        return res.send(result)
      }

      if (type) {
        const query = { productType: type }
        const result = await assetsCollections.find(query).toArray()
        return res.send(result)
      }

      const result = await assetsCollections.find().toArray()
      res.send(result)
    })

    app.get('/assets/individual/:id',verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await assetsCollections.findOne(query)
      res.send(result)
    })

    app.patch('/assets/individual/:id',verifyToken,verifyManager, async (req, res) => {
      const id = req.params.id
      const assetsData = req.body

      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          productName: assetsData.productName,
          productType: assetsData.productType,
          productQuantity: assetsData.productQuantity,
          email: assetsData.email,
          date: assetsData.date,
          availability: assetsData.availability 
        }
      }

      const result = await assetsCollections.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.patch('/assets/return/:id',verifyToken, async (req, res) => {
      const id = req.params.id
      const returnId = req.body.returnId
      
      const query = { _id: new ObjectId(id) }
      const query2 = {_id: new ObjectId(returnId)}
      const updatedDoc = {
        $inc: {
          productQuantity: 1
        }
      }

      const updatedDoc2 = {
        $set: {
          status: 'returned '
        }
      }



      const result = await assetsCollections.updateOne(query, updatedDoc)
      const result2 = await requestCollections.updateOne(query2,updatedDoc2)
      res.send({result,result2})
    })


    // requested apis
    app.post('/requests',verifyToken, async (req, res) => {
      const requestData = req.body
      const { productId, requesterMail } = req.body;

      const existingRequest = await requestCollections.findOne({ productId, requesterMail });
     
      if (existingRequest) {
        const updatedRequest = await requestCollections.updateOne(
          { productId, requesterMail },
          { $inc: { requestCount: 1 } } 
        );
        return res.send(updatedRequest);
      }

      const newRequest = { ...req.body, requestCount: 1 };
      const result = await requestCollections.insertOne(requestData)
      res.send(result)
      
    })

    app.get('/mostRequestsItem', async (req, res) => {
      const result = await requestCollections.find().sort({ requestCount: -1 }).limit(4).toArray()
      res.send(result)
    })

    app.get('/requests',verifyToken,verifyManager, async (req, res) => {
      const { search } = req.query

      let query = {}
      if (search) {
        query = {
          productName: {
            $regex: search,
            $options: 'i'
          }
        }
        const result = await requestCollections.find(query).toArray()
        return res.send(result)
      }

      const result = await requestCollections.find().toArray()
      res.send(result)
    })

    app.get('/requests/:email', verifyToken, async (req, res) => {
      const { status } = req.query
      const { type } = req.query
      const { search } = req.query

      let query = {}
      if (search) {
        query = {
          productName: {
            $regex: search,
            $options: 'i'
          }
        }
        const result = await requestCollections.find(query).toArray()
        return res.send(result)
      }

      if (status) {
        const result = await requestCollections.find({ requesterMail: req.params.email, status: status }).toArray()
        return res.send(result)
      }

      if (type) {
        const result = await requestCollections.find({ requesterMail: req.params.email, productType: type }).toArray()
        return res.send(result)
      }

      
      const result = await requestCollections.find({ requesterMail: req.params.email }).toArray()
      res.send(result)
    })

    app.delete('/requests/:id',verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await requestCollections.deleteOne(query)
      res.send(result)
    })

    app.patch('/requests/:id',verifyToken,verifyManager, async (req, res) => {
      const id = req.params.id
      const approvedData = req.body
      const quantityId = req.body.productId

      const query = { _id: new ObjectId(id) }
      const query2 = { _id: new ObjectId(quantityId) }
      
      const updatedDoc = {
        $set: {
          status: approvedData.status,
          approvalDate: approvedData.approvalDate 
        }
      }
      const updatedDoc2 = {
        $inc: {
          productQuantity: -1
        }
      }
      const result = await requestCollections.updateOne(query, updatedDoc)
      const result2 = await assetsCollections.updateOne(query2,updatedDoc2)
      res.send({ result , result2})
    })

    app.get('/requestsPending/:email',verifyToken, async (req, res) => {
      const email = req.params.email
      const result = await requestCollections.find({ requesterMail: email, status: 'pending' }).toArray()
      res.send(result)
    })

    app.get('/recentRequests/:email',verifyToken, async (req, res) => {
      const email = req.params.email
      const result = await requestCollections.find({ requesterMail: email }).sort({requestedDate: -1 }).toArray()
      res.send(result)
      
    })

    app.get('/allPendingRequests',verifyToken,verifyManager, async (req, res) => {
      const result = await requestCollections.find({ status: 'pending' }).limit(5).toArray()
      res.send(result)
    })

    app.get('/returnableItem',verifyToken,verifyManager, async (req, res) => {
      const result = await requestCollections.find({ status: 'returned ' }).toArray()
      res.send(result)
    })

    app.get('/nonReturnableItem',verifyToken,verifyManager, async (req, res) => {
      const result = await requestCollections.find({ status: 'Approved' }).toArray()
      res.send(result)
    })

    app.get('/limitedQuantity', verifyToken, verifyManager, async (req, res) => {
      const result = await assetsCollections.find({ productQuantity: { $lt: 10 } }).toArray()
      res.send(result)
    })



    // stripe payment getway
    app.post('/create-payment-intent', async (req, res) => {
      const { package } = req.body
      const amount = parseInt(package * 100)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server its Starting......')
})

app.listen(port, () => {
  console.log(`bistro boss runing on ${port}`);
})