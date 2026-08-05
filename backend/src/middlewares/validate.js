const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const validSchema = Joi.object(schema);
  const object = Object.keys(schema).reduce((obj, key) => {
    if (Object.prototype.hasOwnProperty.call(req, key)) {
      obj[key] = req[key];
    }
    return obj;
  }, {});

  const { value, error } = validSchema.validate(object, { abortEarly: false });

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return res.status(400).json({ message: errorMessage });
  }

  Object.assign(req, value);
  return next();
};

module.exports = validate;
