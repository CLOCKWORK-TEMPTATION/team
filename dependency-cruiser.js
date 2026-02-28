/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules|dist|build|out|artifacts"
    },
  }
};
