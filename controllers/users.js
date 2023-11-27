const { User } = require('../models/user');
const bcrypt = require('bcrypt')
const gravatar = require("gravatar");
const { ctrlWrapper, HttpError } = require('../helpers');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const path = require("path");
const fs = require('fs/promises');
const { SECRET_KEY } = process.env
const avatarsDir = path.join(__dirname, "../", "public", "avatars")
const Jimp = require('jimp');

const register = async(req, res)=> {
    const {email,password} = req.body;
    const user = await User.findOne({email});

    if(user){
        throw HttpError(409, "Email already in use");
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const avatarURL = gravatar.url(email);
    const newUser = await User.create({...req.body, password:hashPassword,avatarURL});

    res.status(201).json({
        email: newUser.email,
        subscription:newUser.subscription
    })
}

const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({email});
    if(!user){
        throw HttpError(401, "Email or password invalid!");
    }
   
    const passwordCompare = await bcrypt.compare(password, user.password);
    if (!passwordCompare) {
        throw HttpError(401, "Email or password invalid!");
    }
    const payload = {
        id:user._id,
    }
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });
    await User.findByIdAndUpdate(user._id,{token})
    res.json({
        token: token,
        user: {
    email: user.email,
    subscription: user.subscription
  }
    })
}
const getCurrent = async (req, res) => { 
    const { email, subscription } = req.user;
    res.json({
        email,
        subscription,

    })
}

const logout = async (req, res) => { 
    const {_id} = req.user;
    await User.findByIdAndUpdate(_id, { token: null })
    
    res.status(204).json()
}



const updateSubscribe = async (req, res) => { 
    const {_id} = req.user;
    const updateUser = await User.findByIdAndUpdate(_id, req.body, {new:true})
     if (!updateUser) {
      throw HttpError(404, 'Not found');
    }
      res.json(updateUser.subscription)
}

const updateAvatar = async(req, res)=> {
    const {_id} = req.user;
    const { path: tempUpload, originalname } = req.file;
    const filename = `${_id}_${originalname}`;
    const resultUpload = path.join(avatarsDir, filename);


    await fs.rename(tempUpload, resultUpload );
    const avatarURL = path.join("avatars", filename);
    await User.findByIdAndUpdate(_id, { avatarURL });
    
    await Jimp.read(resultUpload).then(image =>
    {
        return image.resize(250, 250).writeAsync(resultUpload)
    })
    .catch(err => console.log(err));
    res.json({
        avatarURL,
    })
}


module.exports = {
    register: ctrlWrapper(register),
    login: ctrlWrapper(login),
    getCurrent: ctrlWrapper(getCurrent),
    logout: ctrlWrapper(logout),
    updateSubscribe: ctrlWrapper(updateSubscribe),
    updateAvatar:ctrlWrapper(updateAvatar),
    
}