const { User } = require('../models/user');
const bcrypt = require('bcrypt')
const gravatar = require("gravatar");
const { ctrlWrapper, HttpError,sendMail } = require('../helpers');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const path = require("path");
const fs = require('fs/promises');
const { SECRET_KEY, BASE_URL } = process.env
const avatarsDir = path.join(__dirname, "../", "public", "avatars")
const Jimp = require('jimp');
const { nanoid } = require('nanoid');

const register = async(req, res)=> {
    const {email,password} = req.body;
    const user = await User.findOne({email});

    if(user){
        throw HttpError(409, "Email already in use");
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const avatarURL = gravatar.url(email);
    const verificationToken = nanoid();
    const newUser = await User.create({...req.body, password:hashPassword,avatarURL,verificationToken});


    const verifyEmail = {
        to: email,
        subject: "Verify your email",
        html: `<a target="_blank" href="${BASE_URL}/api/users/verify/${verificationToken}">Click verify email</a>`
    }
    await sendMail(verifyEmail);

    res.status(201).json({
        email: newUser.email,
        subscription:newUser.subscription
    })
}

const verifyEmail = async(req, res)=> {
    const {verificationToken} = req.params;
    const user = await User.findOne({verificationToken});
    if(!user){
        throw HttpError(401, "Email not found")
    }
    await User.findByIdAndUpdate(user._id, {verify: true, verificationToken: ""});

   res.status(201).json({
        message: 'Verification successful'
    })
}


const resendVerifyEmail = async(req, res)=> {
    const {email} = req.body;
    const user = await User.findOne({email});
    if(!user) {
        throw HttpError(401, "Email not found");
    }
    if(user.verify) {
        throw HttpError(400, "Verification has already been passed");
    }

    const verifyEmail = {
        to: email,
        subject: "Verify email",
        html: `<a target="_blank" href="${BASE_URL}/api/users/verify/${user.verificationToken}">Click verify email</a>`
    };

    await sendMail(verifyEmail);

    res.status(200).json({
        message: "Verification email sent"
    })
}


const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({email});
    if(!user){
        throw HttpError(401, "Email or password invalid!");
    }
     if(!user.verify){
        throw HttpError(401, "Email not verify!");
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
    verifyEmail: ctrlWrapper(verifyEmail),
    resendVerifyEmail:ctrlWrapper(resendVerifyEmail),
    login: ctrlWrapper(login),
    getCurrent: ctrlWrapper(getCurrent),
    logout: ctrlWrapper(logout),
    updateSubscribe: ctrlWrapper(updateSubscribe),
    updateAvatar:ctrlWrapper(updateAvatar),
    
}