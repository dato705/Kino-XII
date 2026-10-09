import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-800 text-white py-4 px-8 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="text-2xl font-bold tracking-wider text-amber-500">
          KINO<span className="text-white">XII</span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-8 font-medium">
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? "text-amber-500 font-semibold" : "text-gray-300 hover:text-white transition"}
          >
            მთავარი
          </NavLink>
          <NavLink 
            to="/sessions" 
            className={({ isActive }) => isActive ? "text-amber-500 font-semibold" : "text-gray-300 hover:text-white transition"}
          >
            სეანსები
          </NavLink>
        </nav>

        {/* Auth Action Button */}
        <button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5 py-2 rounded-lg transition cursor-pointer">
          შესვლა
        </button>
      </div>
    </header>
  );
}