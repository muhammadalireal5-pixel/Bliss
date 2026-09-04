const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = mongoose.connection.collection('users');
  const user = await users.findOne({});
  if (user) {
    console.log(user._id.toString());
  } else {
    console.log("No user found");
  }
  process.exit();
});
