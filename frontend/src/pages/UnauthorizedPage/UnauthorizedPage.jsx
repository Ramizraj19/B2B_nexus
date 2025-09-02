import React from 'react';

const UnauthorizedPage = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">Unauthorized</h1>
      <p className="text-lg">You do not have permission to access this page.</p>
    </div>
  </div>
);

export default UnauthorizedPage;