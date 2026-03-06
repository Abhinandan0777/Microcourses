const { validationResult } = require('express-validator')

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0]
    return res.status(400).json({
      error: {
        code: 'FIELD_REQUIRED',
        field: firstError.path,
        message: firstError.msg
      }
    })
  }
  
  next()
}

module.exports = {
  handleValidationErrors
}