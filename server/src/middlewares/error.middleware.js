const errorMiddleware = (err, req, res, next) => {

  console.error("🔥 GLOBAL ERROR");

  console.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Sequelize validation
  if (err.name === "SequelizeValidationError") {

    return res.status(400).json({
      success: false,
      message: err.errors[0].message
    });
  }

  // Sequelize duplicate
  if (err.name === "SequelizeUniqueConstraintError") {

    return res.status(400).json({
      success: false,
      message: "Duplicate value exists"
    });
  }

  // JWT
  if (err.name === "JsonWebTokenError") {

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }

  // JWT expired
  if (err.name === "TokenExpiredError") {

    return res.status(401).json({
      success: false,
      message: "Token expired"
    });
  }

  // Multer
  if (err.code === "LIMIT_FILE_SIZE") {

    return res.status(400).json({
      success: false,
      message: "File too large"
    });
  }

  // Default
  return res.status(err.status || 500).json({

    success: false,

    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message
  });
};

export default errorMiddleware;