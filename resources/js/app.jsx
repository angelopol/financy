import React from "react";
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
    return (
        <div>
            <h1>Pp</h1>
            <button className="btn btn-primary">Holii</button>
        </div>
    );
};

if (document.getElementById('root')) {
    const Index = ReactDOM.createRoot(document.getElementById("root"));
    Index.render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    )
}