const authService = require('../services/authService');

const loginAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.loginAdmin(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

const loginSupervisor = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const result = await authService.loginSupervisor(phone, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

const loginContractor = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.loginContractor(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

module.exports = {
  loginAdmin,
  loginSupervisor,
  loginContractor,
};
